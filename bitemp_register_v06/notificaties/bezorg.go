package notificaties

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/tls"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"mime"
	"net"
	"net/http"
	"net/smtp"
	"strings"
	"time"
)

// VerstuurWebhook post het CloudEvents-bericht (structured mode) naar de abonnee.
// Headers: Content-Type application/cloudevents+json, Idempotency-Key (= id), en bij een
// geheim X-Omnium-Signature: sha256=<hex HMAC van de body>. 2xx = bevestigd (NORA: 200 pas na
// gegarandeerde verwerking); 429 met Retry-After wordt door de aanroeper als herpoging behandeld.
func VerstuurWebhook(ctx context.Context, client *http.Client, a Abonnee, ce CloudEvent) (int, error) {
	body, err := json.Marshal(ce)
	if err != nil {
		return 0, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, a.Adres, bytes.NewReader(body))
	if err != nil {
		return 0, err
	}
	req.Header.Set("Content-Type", "application/cloudevents+json; charset=utf-8")
	req.Header.Set("Idempotency-Key", ce.ID)
	req.Header.Set("User-Agent", "omnium-notificaties/1")
	if a.Geheim != "" {
		req.Header.Set("X-Omnium-Signature", "sha256="+Handtekening(a.Geheim, body))
	}
	res, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode > 299 {
		return res.StatusCode, fmt.Errorf("HTTP %d", res.StatusCode)
	}
	return res.StatusCode, nil
}

// Handtekening — hex HMAC-SHA256 over de body.
func Handtekening(geheim string, body []byte) string {
	h := hmac.New(sha256.New, []byte(geheim))
	h.Write(body)
	return hex.EncodeToString(h.Sum(nil))
}

// VerstuurEmail stuurt een platte-tekstmail via SMTP: TLS vanaf de verbinding op 465 (de
// Quickhost-instelling, standaard), STARTTLS op andere poorten. Certificaatcontrole staat altijd aan.
// Zonder SMTP_HOST wordt niets verstuurd (fout), zodat het bezorglog dat laat zien.
func VerstuurEmail(cfg SMTPConfig, aan, onderwerp, tekst string) error {
	if cfg.Host == "" {
		return fmt.Errorf("SMTP niet geconfigureerd (SMTP_HOST leeg)")
	}
	afzender := cfg.Afzender
	if afzender == "" {
		afzender = cfg.User
	}
	adres := net.JoinHostPort(cfg.Host, fmt.Sprint(cfg.Poort))
	bericht := strings.Join([]string{
		"From: " + afzender,
		"To: " + aan,
		"Subject: " + mime.QEncoding.Encode("utf-8", onderwerp),
		"Date: " + time.Now().UTC().Format(time.RFC1123Z),
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=utf-8",
		"Content-Transfer-Encoding: 8bit",
		"",
		tekst,
	}, "\r\n")

	var c *smtp.Client
	var err error
	if cfg.Poort == 465 {
		conn, derr := tls.Dial("tcp", adres, &tls.Config{ServerName: cfg.Host})
		if derr != nil {
			return derr
		}
		c, err = smtp.NewClient(conn, cfg.Host)
	} else {
		c, err = smtp.Dial(adres)
	}
	if err != nil {
		return err
	}
	defer c.Close()
	if cfg.Poort != 465 {
		if ok, _ := c.Extension("STARTTLS"); ok {
			if err := c.StartTLS(&tls.Config{ServerName: cfg.Host}); err != nil {
				return err
			}
		}
	}
	if cfg.User != "" {
		if err := c.Auth(smtp.PlainAuth("", cfg.User, cfg.Wachtwoord, cfg.Host)); err != nil {
			return err
		}
	}
	if err := c.Mail(afzender); err != nil {
		return err
	}
	if err := c.Rcpt(aan); err != nil {
		return err
	}
	w, err := c.Data()
	if err != nil {
		return err
	}
	if _, err := w.Write([]byte(bericht)); err != nil {
		return err
	}
	if err := w.Close(); err != nil {
		return err
	}
	return c.Quit()
}

// VulSjabloon vervangt {{type}}, {{subject}}, {{id}}, {{entiteit}}, {{registratieId}},
// {{registratietype}}, {{bron}}, {{tijdstip}}, {{link}} en {{dataref}}.
func VulSjabloon(sjabloon string, g Gebeurtenis, ce CloudEvent, cfg Config) string {
	r := strings.NewReplacer(
		"{{type}}", ce.Type, "{{subject}}", ce.Subject, "{{id}}", g.EntiteitID, "{{entiteit}}", g.Entiteit.Klassenaam,
		"{{registratieId}}", fmt.Sprint(g.RegistratieID), "{{registratietype}}", strings.ToLower(g.Registratietype),
		"{{bron}}", g.Bron, "{{tijdstip}}", ce.Time, "{{link}}", g.Link(cfg), "{{dataref}}", g.DataRef(cfg),
	)
	return r.Replace(sjabloon)
}

// StandaardOnderwerp/-tekst als de definitie geen inhoud heeft.
func StandaardOnderwerp(g Gebeurtenis, ce CloudEvent) string {
	return fmt.Sprintf("%s %s (%s)", g.Entiteit.Klassenaam, g.EntiteitID, g.Soort())
}
func StandaardTekst(g Gebeurtenis, ce CloudEvent, cfg Config) string {
	return fmt.Sprintf("Gebeurtenis %s\n%s %s is %s (registratie %d, bron %s).\n\n%s\n",
		ce.Type, g.Entiteit.Klassenaam, g.EntiteitID, g.Soort(), g.RegistratieID, nietLeeg(g.Bron, "-"), g.Link(cfg))
}

func nietLeeg(s, anders string) string {
	if s == "" {
		return anders
	}
	return s
}
