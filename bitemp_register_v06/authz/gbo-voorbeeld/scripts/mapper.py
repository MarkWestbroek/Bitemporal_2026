"""mapper.py — de GBO-mapper: GraphQL-over-HTTP-body + SDL -> veldrecords.

Volgt het FTV GraphQL-profiel draft-01 (§5): parse, valideer tegen het SDL uit
de bundel, kies de operatie, loop de selectieset en maak per veld één record
  { path, parentType, field, leaf, args: { naam: { value, origin } }, on }
De uitvoer is een AuthZEN-request met resource.properties.graphql.

Vereenvoudigingen t.o.v. het profiel: geen limieten, geen digest-pinning,
alleen inline én benoemde fragmenten (geen @skip/@include-evaluatie).
"""
import hashlib
import json
import sys

from graphql import (
    GraphQLError,
    build_schema,
    get_named_type,
    parse,
    validate,
)
from graphql.pyutils import Undefined
from graphql.utilities import value_from_ast
from graphql.language import ast as gast

PROFIEL = "ftv-graphql/0.1"


def _origin(arg_node, variables):
    v = arg_node.value
    if isinstance(v, gast.VariableNode):
        return f"variable:{v.name.value}"
    return "literal"


def _bevat_variabele(node):
    if isinstance(node, gast.VariableNode):
        return True
    if isinstance(node, gast.ListValueNode):
        return any(_bevat_variabele(x) for x in node.values)
    if isinstance(node, gast.ObjectValueNode):
        return any(_bevat_variabele(f.value) for f in node.fields)
    return False


def maak_veldrecords(schema, document, operatie, variables):
    fragmenten = {d.name.value: d for d in document.definitions if isinstance(d, gast.FragmentDefinitionNode)}
    records = []

    def loop(selection_set, parent_type, path, on=None):
        for sel in selection_set.selections:
            if isinstance(sel, gast.FieldNode):
                naam = sel.name.value
                key = sel.alias.value if sel.alias else naam
                record = {"path": path + [key], "parentType": parent_type.name, "field": naam,
                          "leaf": sel.selection_set is None}
                if on:
                    record["on"] = on
                if naam.startswith("__"):
                    records.append(record)
                    continue
                field_def = parent_type.fields[naam]
                args = {}
                aanwezig = {a.name.value: a for a in (sel.arguments or ())}
                for argnaam, argdef in field_def.args.items():
                    if argnaam in aanwezig:
                        node = aanwezig[argnaam].value
                        waarde = value_from_ast(node, argdef.type, variables)
                        origin = _origin(aanwezig[argnaam], variables)
                        if origin.startswith("variable:") and waarde is None:
                            # variabele afwezig: variabele-default of ontbrekend
                            continue
                        args[argnaam] = {"value": waarde, "origin": origin}
                        if origin == "literal" and _bevat_variabele(node):
                            args[argnaam]["origin"] = "mixed"
                    elif argdef.default_value is not Undefined:
                        args[argnaam] = {"value": argdef.default_value, "origin": "schema-default"}
                if args:
                    record["args"] = args
                records.append(record)
                if sel.selection_set is not None:
                    loop(sel.selection_set, get_named_type(field_def.type), path + [key])
            elif isinstance(sel, gast.InlineFragmentNode):
                t = schema.get_type(sel.type_condition.name.value) if sel.type_condition else parent_type
                loop(sel.selection_set, t, path, on=t.name if sel.type_condition else None)
            elif isinstance(sel, gast.FragmentSpreadNode):
                fd = fragmenten[sel.name.value]
                t = schema.get_type(fd.type_condition.name.value)
                loop(fd.selection_set, t, path, on=t.name)

    loop(operatie.selection_set, schema.query_type, [])
    return records


def map_request(sdl, body, subject, context=None):
    schema = build_schema(sdl)
    digest = "sha256:" + hashlib.sha256(sdl.encode("utf-8")).hexdigest()
    gql = {"profile": PROFIEL, "operation": None, "schema": {"digest": digest}, "fields": [], "unverifiable": None}
    try:
        document = parse(body["query"])
        fouten = validate(schema, document)
        if fouten:
            raise GraphQLError("; ".join(f.message for f in fouten))
        ops = [d for d in document.definitions if isinstance(d, gast.OperationDefinitionNode)]
        naam = body.get("operationName")
        if naam:
            ops = [o for o in ops if o.name and o.name.value == naam]
        if len(ops) != 1:
            raise GraphQLError("OPERATION_AMBIGUOUS")
        op = ops[0]
        if op.operation.value != "query":
            gql["unverifiable"] = {"code": "OPERATION_NOT_SUPPORTED"}
        else:
            gql["operation"] = {"type": "query", "name": op.name.value if op.name else None}
            gql["fields"] = maak_veldrecords(schema, document, op, body.get("variables") or {})
    except GraphQLError as e:
        gql["unverifiable"] = {"code": "INVALID_QUERY", "detail": str(e)}
    return {
        "subject": subject,
        "action": {"name": "POST", "properties": {"body": json.dumps(body)}},
        "resource": {"type": "http", "id": "/graphql", "properties": {"graphql": gql}},
        "context": context or {},
    }


if __name__ == "__main__":
    # python scripts/mapper.py bundel/schema.graphql queries/x.json  -> AuthZEN-request op stdout
    sdl = open(sys.argv[1], encoding="utf-8").read()
    q = json.load(open(sys.argv[2], encoding="utf-8"))
    print(json.dumps(map_request(sdl, q["body"], q["subject"], q.get("context")), ensure_ascii=False, indent=2))
