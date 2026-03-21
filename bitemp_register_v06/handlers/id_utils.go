package handlers

func isZeroID(id any) bool {
	switch value := id.(type) {
	case nil:
		return true
	case string:
		return value == ""
	case int:
		return value == 0
	case int8:
		return value == 0
	case int16:
		return value == 0
	case int32:
		return value == 0
	case int64:
		return value == 0
	case uint:
		return value == 0
	case uint8:
		return value == 0
	case uint16:
		return value == 0
	case uint32:
		return value == 0
	case uint64:
		return value == 0
	default:
		return false
	}
}
