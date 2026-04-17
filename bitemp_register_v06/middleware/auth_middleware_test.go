package middleware

import (
	"os"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestGenereerEnValideerJWT(t *testing.T) {
	// Gebruik een deterministische test-secret
	os.Setenv("JWT_SECRET", "test-secret-12345")
	defer os.Unsetenv("JWT_SECRET")

	token, err := GenereerJWT("testuser", "editor", "test@example.com")
	if err != nil {
		t.Fatalf("GenereerJWT mislukt: %v", err)
	}
	if token == "" {
		t.Fatal("GenereerJWT gaf een lege string")
	}

	// Valideer het token
	claims, err := ValideerJWT(token)
	if err != nil {
		t.Fatalf("ValideerJWT mislukt: %v", err)
	}
	if claims.Gebruikersnaam != "testuser" {
		t.Errorf("verwacht gebruikersnaam 'testuser', kreeg '%s'", claims.Gebruikersnaam)
	}
	if claims.Rol != "editor" {
		t.Errorf("verwacht rol 'editor', kreeg '%s'", claims.Rol)
	}
	if claims.Email != "test@example.com" {
		t.Errorf("verwacht email 'test@example.com', kreeg '%s'", claims.Email)
	}
	if claims.Subject != "testuser" {
		t.Errorf("verwacht subject 'testuser', kreeg '%s'", claims.Subject)
	}
	if claims.Issuer != "bitemp-register-v06" {
		t.Errorf("verwacht issuer 'bitemp-register-v06', kreeg '%s'", claims.Issuer)
	}
}

func TestValideerJWT_OngeldigToken(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret-12345")
	defer os.Unsetenv("JWT_SECRET")

	_, err := ValideerJWT("ongeldig-token")
	if err == nil {
		t.Fatal("verwacht fout bij ongeldig token, maar geen fout ontvangen")
	}
}

func TestValideerJWT_VerlopenToken(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret-12345")
	defer os.Unsetenv("JWT_SECRET")

	// Maak een token dat al verlopen is
	claims := JWTClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   "verlopen",
			IssuedAt:  jwt.NewNumericDate(time.Now().Add(-48 * time.Hour)),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-24 * time.Hour)),
			Issuer:    "bitemp-register-v06",
		},
		Gebruikersnaam: "verlopen",
		Rol:            "viewer",
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte("test-secret-12345"))
	if err != nil {
		t.Fatalf("token aanmaken mislukt: %v", err)
	}

	_, err = ValideerJWT(tokenString)
	if err == nil {
		t.Fatal("verwacht fout bij verlopen token, maar geen fout ontvangen")
	}
}

func TestValideerJWT_VerkeerdeSecret(t *testing.T) {
	os.Setenv("JWT_SECRET", "secret-A")
	defer os.Unsetenv("JWT_SECRET")

	token, err := GenereerJWT("user1", "viewer", "")
	if err != nil {
		t.Fatalf("GenereerJWT mislukt: %v", err)
	}

	// Verander de secret
	os.Setenv("JWT_SECRET", "secret-B")

	_, err = ValideerJWT(token)
	if err == nil {
		t.Fatal("verwacht fout bij verkeerde secret, maar geen fout ontvangen")
	}
}

func TestRolToegestaan(t *testing.T) {
	tests := []struct {
		huidig   string
		vereist  string
		verwacht bool
	}{
		{"admin", "admin", true},
		{"admin", "editor", true},
		{"admin", "viewer", true},
		{"editor", "editor", true},
		{"editor", "viewer", true},
		{"editor", "admin", false},
		{"viewer", "viewer", true},
		{"viewer", "editor", false},
		{"viewer", "admin", false},
	}

	for _, tt := range tests {
		result := rolToegestaan(tt.huidig, tt.vereist)
		if result != tt.verwacht {
			t.Errorf("rolToegestaan(%s, %s) = %v, verwacht %v", tt.huidig, tt.vereist, result, tt.verwacht)
		}
	}
}

func TestIsAuthEnabled(t *testing.T) {
	// Standaard: uitgeschakeld
	os.Unsetenv("AUTH_ENABLED")
	if IsAuthEnabled() {
		t.Error("verwacht dat auth uitgeschakeld is zonder AUTH_ENABLED")
	}

	// Ingeschakeld met diverse waarden
	for _, val := range []string{"true", "1", "yes", "on", "TRUE", " True "} {
		os.Setenv("AUTH_ENABLED", val)
		if !IsAuthEnabled() {
			t.Errorf("verwacht dat auth ingeschakeld is met AUTH_ENABLED=%q", val)
		}
	}

	// Uitgeschakeld
	for _, val := range []string{"false", "0", "no", "off", ""} {
		os.Setenv("AUTH_ENABLED", val)
		if IsAuthEnabled() {
			t.Errorf("verwacht dat auth uitgeschakeld is met AUTH_ENABLED=%q", val)
		}
	}
	os.Unsetenv("AUTH_ENABLED")
}
