@reason("beheerders: alle entiteittypen")
permit (
    principal is pabc_gebruiker,
    action in [name::"zaakafhandelcomponent/administrator", name::"zaakafhandelcomponent/beheerder"],
    resource is pabc_entiteittype
)
when {
    principal.functioneleRollen.contains("beheerders")
};

@reason("medewerkers: domein voorbeeld-a")
permit (
    principal is pabc_gebruiker,
    action in [name::"zaakafhandelcomponent/behandelaar", name::"zaakafhandelcomponent/raadpleger"],
    resource is pabc_entiteittype
)
when {
    principal.functioneleRollen.contains("medewerkers") &&
    resource.domeinen.contains("voorbeeld-a")
};

@reason("medewerkers: domein voorbeeld-b")
permit (
    principal is pabc_gebruiker,
    action in [name::"zaakafhandelcomponent/raadpleger"],
    resource is pabc_entiteittype
)
when {
    principal.functioneleRollen.contains("medewerkers") &&
    resource.domeinen.contains("voorbeeld-b")
};

@reason("medewerkers: zaakafhandelcomponent zonder entiteittype")
permit (
    principal is pabc_gebruiker,
    action in [name::"zaakafhandelcomponent/brp_zoeken"],
    resource == pabc_applicatie::"zaakafhandelcomponent"
)
when {
    principal.functioneleRollen.contains("medewerkers")
};

@reason("startbeleid uitgezet: de voorbeeldpolicies beslissen")
permit (
    principal,
    action,
    resource
)
when { false };
