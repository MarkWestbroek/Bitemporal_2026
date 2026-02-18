package model

// Equal returns true if two values of a comparable type are equal using `==`.
// Use this when you want a compile-time checked generic equality for comparable types.
func Equal[T comparable](a, b T) bool {
	return a == b
}
