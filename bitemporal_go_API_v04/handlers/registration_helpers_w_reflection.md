# registration_helpers.go — Notes

## `reflectWaardeNaarFormeleRepresentatie`

### The pointer-receiver fallback block

```go
if waarde.Kind() != reflect.Ptr && waarde.CanAddr() {
    if rep, ok := waarde.Addr().Interface().(model.FormeleRepresentatie); ok {
        return rep, true
    }
}
```

This block is a **second attempt** to discover whether a reflected value implements `model.FormeleRepresentatie`, specifically to cover types that do so via **pointer receivers**.

#### Why a second attempt is needed

The earlier check (`waarde.Interface().(model.FormeleRepresentatie)`) tests whether the value *as-is* satisfies the interface. If a struct type `T` implements the interface's methods with pointer receivers (`func (t *T) ...`), then a plain `T` value does **not** satisfy the interface — only `*T` does. The second block handles exactly that case by working with a pointer to the value.

#### The two guard conditions

**`waarde.Kind() != reflect.Ptr`**

Ensures the value is not already a pointer. If it were, calling `.Addr()` would produce a pointer-to-pointer (`**T`), which would never match the interface and is almost certainly unintended.

**`waarde.CanAddr()`**

Not all reflected values are addressable in memory. Values obtained directly from an interface, from a map element, or from certain other sources cannot have their address taken. Calling `.Addr()` on a non-addressable value causes a **panic**, so this guard is essential.

#### The inner type assertion

Once both guards pass:

1. `.Addr()` returns a new `reflect.Value` representing `*T` — a pointer to the original value.
2. `.Interface()` extracts it as a plain `any`.
3. `.(model.FormeleRepresentatie)` is a standard Go type assertion that checks whether `*T` satisfies the interface.

The comma-ok form (`rep, ok := ...`) means the assertion never panics; `ok` is simply `false` if the type does not implement the interface.

#### Summary

| Step | What it does |
|---|---|
| `Kind() != reflect.Ptr` | Prevents creating `**T` |
| `CanAddr()` | Prevents a panic on non-addressable values |
| `.Addr().Interface()` | Produces `*T` as an `any` |
| `.(model.FormeleRepresentatie)` | Checks if `*T` implements the interface |

## `reflect.ValueOf(entiteit)`

`reflect.ValueOf(entiteit)` maakt een reflectie-representatie van de runtime-waarde die in `entiteit` zit. In deze code is `entiteit` een interface (`model.FormeleRepresentatie`), en met `ValueOf` pak je de concrete onderliggende waarde (bijvoorbeeld `*model.Full_A`) zodat je die generiek kunt inspecteren.

Dat `reflect.Value`-object (`waarde`) is vervolgens het startpunt voor alle reflectie-operaties zoals `Kind()`, `Elem()`, `NumField()`, `Field(i)` en `CanAddr()`. Daardoor kan de functie over velden en kinderen lopen zonder vooraf exact te weten welk concreet type binnenkomt.

Direct na `ValueOf` zie je daarom de pointer-unwrapping stap (`for waarde.Kind() == reflect.Ptr { ... waarde = waarde.Elem() }`). Die haalt lagen `*` weg totdat je bij de onderliggende struct komt, zodat `NumField()` en `Field(i)` veilig en zinvol gebruikt kunnen worden.
