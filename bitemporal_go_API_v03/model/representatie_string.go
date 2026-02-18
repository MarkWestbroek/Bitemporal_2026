package model

import (
	"fmt"
	"reflect"
	"strings"
	"time"
)

func RepresentatieToString(rep Representatie) string {
	if rep == nil {
		return "<nil representatie>"
	}

	var builder strings.Builder
	visited := map[uintptr]bool{}
	writeValueTree(&builder, "representatie", reflect.ValueOf(rep), 0, visited)
	return builder.String()
}

func writeValueTree(builder *strings.Builder, label string, value reflect.Value, depth int, visited map[uintptr]bool) {
	indent := strings.Repeat("  ", depth)

	if !value.IsValid() {
		builder.WriteString(fmt.Sprintf("%s%s=<invalid>\n", indent, label))
		return
	}

	for value.Kind() == reflect.Interface || value.Kind() == reflect.Pointer {
		if value.IsNil() {
			builder.WriteString(fmt.Sprintf("%s%s=<nil>\n", indent, label))
			return
		}

		if value.Kind() == reflect.Pointer {
			ptr := value.Pointer()
			if ptr != 0 {
				if visited[ptr] {
					builder.WriteString(fmt.Sprintf("%s%s=<cycle>\n", indent, label))
					return
				}
				visited[ptr] = true
			}
		}

		value = value.Elem()
	}

	if value.CanInterface() {
		if rep, ok := value.Interface().(Representatie); ok {
			builder.WriteString(fmt.Sprintf("%s- %s: type=%T metatype=%s id=%v\n", indent, label, rep, rep.Metatype(), rep.GetID()))
		}
	}

	if value.Type() == reflect.TypeOf(time.Time{}) {
		t := value.Interface().(time.Time)
		builder.WriteString(fmt.Sprintf("%s  %s=%s\n", indent, label, t.Format(time.RFC3339Nano)))
		return
	}

	switch value.Kind() {
	case reflect.Struct:
		structType := value.Type()
		for i := 0; i < value.NumField(); i++ {
			fieldType := structType.Field(i)
			fieldValue := value.Field(i)

			if !fieldType.IsExported() {
				continue
			}

			if fieldType.Anonymous && fieldType.Type.String() == "bun.BaseModel" {
				continue
			}

			if isZeroReflectValue(fieldValue) {
				continue
			}

			writeValueTree(builder, fieldType.Name, fieldValue, depth+1, visited)
		}
	case reflect.Slice, reflect.Array:
		for i := 0; i < value.Len(); i++ {
			item := value.Index(i)
			writeValueTree(builder, fmt.Sprintf("%s[%d]", label, i), item, depth+1, visited)
		}
	default:
		if value.CanInterface() {
			builder.WriteString(fmt.Sprintf("%s%s=%v\n", indent, label, value.Interface()))
		}
	}
}

func isZeroReflectValue(value reflect.Value) bool {
	deferred := value
	for deferred.Kind() == reflect.Interface || deferred.Kind() == reflect.Pointer {
		if deferred.IsNil() {
			return true
		}
		deferred = deferred.Elem()
	}

	return deferred.IsZero()
}
