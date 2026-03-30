# TODO

## API logging

- [ ] Voeg file-based API logging toe voor requests en responses.
- [ ] Schrijf logs naar een configureerbaar pad via env var (bijv. `API_LOG_FILE`).
- [ ] Voeg logrotatie toe (max size / aantal backups / age).
- [ ] Log minimaal: timestamp, method, path, status, latency, request-id.
- [ ] Maak body logging configureerbaar (uit in productie, aan in debug).
- [ ] Voeg redactie toe voor gevoelige velden (bijv. tokens, bsn, auth headers).
- [ ] Documenteer alle env vars en defaults in README.
