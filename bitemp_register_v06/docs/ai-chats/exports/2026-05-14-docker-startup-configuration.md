# Chat: Docker startup configuration

- **Datum**: 2026-05-14 15:49
- **Sessie-ID**: `86f20e4e-b78f-4cb9-8df2-0c34717c09da`
- **Berichten**: 4

---

## 🧑 User

Docker start zo op: (img)

Ik wil echter :
- sweet agnesi
- open FTV

wel

En backend2 (pleio) niet laten starten bij opstarten van Docker.

-> img 2

Hoe doe ik dat?

---

## 🤖 Assistant

De `sweet_agnesi` en `backend2` containers zijn **geen** onderdeel van jouw v06 compose-bestanden — ze zijn afzonderlijke projecten. De oplossing zit in **restart policies**.

## Hoe het werkt

Docker start containers met `restart: always` of `restart: unless-stopped` automatisch opnieuw bij het starten van Docker Desktop. Containers met `restart: "no"` (de default) worden **niet** automatisch gestart.

---

## Stap 1 — `sweet_agnesi` (standalone postgres)

Als deze container niet via een compose-bestand is aangemaakt, gebruik dan dit commando eenmalig:

```powershell
docker update --restart unless-stopped sweet_agnesi
```

---

## Stap 2 — OpenFTV containers

Die zitten in jouw  compose-project. Controleer of de gewenste services al `restart: unless-stopped` hebben in de relevante compose-bestanden, en voeg dat toe waar het ontbreekt.

---

## Stap 3 — `backend2` (pleio) — NIET auto-starten

Zoek het docker-compose bestand van het `backend2`-project en zorg dat de services **geen** restart policy hebben, of expliciet `restart: "no"`:

```yaml
services:
  backend2:
    restart: "no"   # of gewoon weglaten — "no" is de default
```

Als de container al draait met een restart-policy, eenmalig updaten:

```powershell
docker update --restart no <container-id-of-naam>
```

---

## Alternatief via Docker Desktop UI

Nieuwere versies van Docker Desktop hebben een **drie-puntjes-menu (⋮)** per compose-groep waar je "Configure" of "Start when Docker Desktop starts" kunt aan/uitzetten — maar de restart-policy in de compose-bestanden is de betrouwbaardere methode en werkt altijd.

---

## 🧑 User

stap 2 docker compose is:
```


services:
  postgres:
    image: postgres:15-alpine
    container_name: bitemp-go-db-v06
    environment:
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-1234}
      POSTGRES_DB: ${DB_NAME:-bitemp_go_db_v06}
    ports:
      - "${PG_PORT:-5433}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-postgres}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - task_manager_network

  minio:
    image: minio/minio:latest
    container_name: bitemp-minio-v06
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY:-minioadmin}
    ports:
      - "${MINIO_API_PORT:-9000}:9000"
      - "${MINIO_CONSOLE_PORT:-9001}:9001"
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - task_manager_network

  minio-init:
    image: minio/mc:latest
    container_name: bitemp-minio-init-v06
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
      mc alias set local http://minio:9000 $${MINIO_ROOT_USER:-minioadmin} $${MINIO_ROOT_PASSWORD:-minioadmin};
      mc mb --ignore-existing local/ide-bestanden;
      echo 'Bucket ide-bestanden aangemaakt of bestond al.';
      "
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY:-minioadmin}
    networks:
      - task_manager_network

  api:
    build:
      context: .
      args:
        COMMIT: ${COMMIT:-local}
        BUILD_TIME: ${BUILD_TIME:-dev}
    container_name: bitemp-go-api-v06
    environment:
      DATABASE_URL: postgres://${DB_USER:-postgres}:${DB_PASSWORD:-1234}@postgres:5432/${DB_NAME:-bitemp_go_db_v06}?sslmode=disable
      APP_ENV: ${APP_ENV:-development}
      GIN_MODE: ${GIN_MODE:-debug}
      ALLOW_DROP_TABLES: ${ALLOW_DROP_TABLES:-false}
      ADMIN_DROP_PASSWORD: ${ADMIN_DROP_PASSWORD:-1234}
      MINIO_ENDPOINT: minio:9000
      MINIO_ACCESS_KEY: ${MINIO_ACCESS_KEY:-minioadmin}
      MINIO_SECRET_KEY: ${MINIO_SECRET_KEY:-minioadmin}
      MINIO_BUCKET: ${MINIO_BUCKET:-ide-bestanden}
      MINIO_USE_SSL: "false"
    ports:
      - "${API_PORT:-8082}:8080"
    depends_on:
      postgres:
        condition: service_healthy
      minio:
        condition: service_healthy
    networks:
      - task_manager_network

volumes:
  postgres_data:
  minio_data:

networks:
  task_manager_network:
    driver: bridge
```

stap 3:
```
services:

  nginx-proxy:
    image: nginxproxy/nginx-proxy:1.8
    ports:
      - "8000:80"
    environment:
      DEFAULT_HOST: localhost
    volumes:
      - /var/run/docker.sock:/tmp/docker.sock:ro
      - ./docker/vhost.d:/etc/nginx/vhost.d

  api:
    extends:
      file: docker-compose.extend.backend.yml
      service: backend
    environment:
      VIRTUAL_HOST: localhost
      VIRTUAL_PATH: /
      VIRTUAL_PORT: 8000
    depends_on:
      - db
      - nginx-proxy
      - background
      - redis
    profiles:
      - full
      - base

  background:
    extends:
      file: docker-compose.extend.backend.yml
      service: backend
    environment:
      CELERY_WORKER_MAX_TASKS_PER_CHILD: 100
    depends_on:
      - db
      - rabbitmq
      - elasticsearch
      - redis
    command: [ "/start-background.sh" ]

  admin:
    extends:
      file: docker-compose.extend.backend.yml
      service: backend
    environment:
      RUN_AS_ADMIN_APP: 'True'
    depends_on:
      - db
    ports:
      - "8888:8000"
    command: [ "/start-admin-dev.sh" ]
    profiles:
      - full
      - admin

  subscription-api:
    extends:
      file: docker-compose.extend.backend.yml
      service: backend
    environment:
      VIRTUAL_HOST: localhost
      VIRTUAL_PATH: /subscriptions
      VIRTUAL_PORT: 8989
    command: [ "/start-websocket.sh" ]
    depends_on:
      - db
      - rabbitmq
    profiles:
      - full
      - subscriptions

  frontend:
    image: registry.gitlab.com/pleio/frontend:${FRONTEND_IMAGE_TAG:-latest}
    volumes:
      - frontend-build:/shared
    command: sh -c "rm -Rf /shared/* && cp -Rp /usr/share/nginx/html/. /shared && chown -R www-data:www-data /shared 2>/dev/null || true"
    profiles:
      - full
      - frontend

  db:
    image: postgres:17.5
    environment:
      POSTGRES_PASSWORD: postgres
      LC_COLLATE: 'C.UTF-8'
      LC_CTYPE: 'C.UTF-8'
    ports:
      - 15432:5432
    volumes:
      - postgres_data:/var/lib/postgresql/data/
      - ./docker/db:/docker-entrypoint-initdb.d

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.19.2
    environment:
      - xpack.security.enabled=false
      - bootstrap.memory_lock=true
      - cluster.name=docker-cluster
      - cluster.routing.allocation.disk.threshold_enabled=false
      - discovery.type=single-node
      - http.max_content_length=10mb
      - ES_JAVA_OPTS=-Xms1g -Xmx1g
    ulimits:
      memlock:
        soft: -1
        hard: -1
    volumes:
      - esdata01:/usr/share/elasticsearch/data
    healthcheck:
      interval: 20s
      retries: 10
      test: curl -s http://localhost:9200/_cluster/health | grep -vq '"status":"red"'
    ports:
      - 19200:9200

  mailcatcher:
    image: dockage/mailcatcher:0.9.0
    ports:
      - "1080:1080"
    profiles:
      - full
      - mailcatcher

  rabbitmq:
    image: 'rabbitmq:3.13.7-management-alpine'
    ports:
      - '5672:5672'
      - '15672:15672'
    environment:
      AMQP_URL: 'amqp://localhost?connection_attempts=5&retry_delay=5'
      RABBITMQ_DEFAULT_USER: "guest"
      RABBITMQ_DEFAULT_PASS: "guest"

  redis:
    image: 'redis:6.2'
    ports:
      - '16379:6379'

  clamav:
    image: clamav/clamav-debian:1.4
    environment:
      CLAMD_CONF_FILE: /mnt/clamd.conf
    volumes:
      - ./docker/clamd.conf:/mnt/clamd.conf
    profiles:
      - full
      - clamav

  minio:
    image: minio/minio:latest
    ports:
      - '9010:9000'
      - '9011:9001'
    volumes:
      - './docker:/docker'
      - './media/minio:/data'
    environment:
      - MINIO_ROOT_USER=pleio_dev
      - MINIO_ROOT_PASSWORD=pleio_dev
      - MINIO_ACCESS_KEY=pleio_dev_key
      - MINIO_ACCESS_SECRET=pleio_dev_secret
    command: ["minio", "server", "/data", "--console-address", ":9001"]
    entrypoint: ["/docker/minio-start-dev.sh"]
    profiles:
      - full
      - minio

volumes:
  frontend-build:
  shared-tmp:
  postgres_data:
  esdata01:
    driver: local
```

wil je deze (hier in tekst, ik plak het dan terug) aanpassen zodat ze herstarten?

---

## 🤖 Assistant

Kleine vraag vooraf: in mijn vorige antwoord was **stap 3** juist om `restart: "no"` te zetten op backend2 (niet laten starten). Nu vraag je beide aan te passen "zodat ze herstarten" — wil je backend2 toch ook laten auto-starten, of wil je:
- **Stap 2** (bitemp): `restart: unless-stopped` ✅
- **Stap 3** (backend2/pleio): `restart: "no"` (expliciet géén auto-start) ❌

Ik ga uit van de originele wens: stap 2 aan, stap 3 uit. Hier zijn beide bestanden:

---

### Stap 2 — bitemp v06 compose

> `minio-init` is een one-shot container (draait eenmalig en stopt). Die krijgt `restart: "no"`, anders herstart hij eindeloos.

```yaml
services:
  postgres:
    image: postgres:15-alpine
    container_name: bitemp-go-db-v06
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-1234}
      POSTGRES_DB: ${DB_NAME:-bitemp_go_db_v06}
    ports:
      - "${PG_PORT:-5433}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-postgres}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - task_manager_network

  minio:
    image: minio/minio:latest
    container_name: bitemp-minio-v06
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY:-minioadmin}
    ports:
      - "${MINIO_API_PORT:-9000}:9000"
      - "${MINIO_CONSOLE_PORT:-9001}:9001"
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - task_manager_network

  minio-init:
    image: minio/mc:latest
    container_name: bitemp-minio-init-v06
    restart: "no"
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
      mc alias set local http://minio:9000 $${MINIO_ROOT_USER:-minioadmin} $${MINIO_ROOT_PASSWORD:-minioadmin};
      mc mb --ignore-existing local/ide-bestanden;
      echo 'Bucket ide-bestanden aangemaakt of bestond al.';
      "
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY:-minioadmin}
    networks:
      - task_manager_network

  api:
    build:
      context: .
      args:
        COMMIT: ${COMMIT:-local}
        BUILD_TIME: ${BUILD_TIME:-dev}
    container_name: bitemp-go-api-v06
    restart: unless-stopped
    environment:
      DATABASE_URL: postgres://${DB_USER:-postgres}:${DB_PASSWORD:-1234}@postgres:5432/${DB_NAME:-bitemp_go_db_v06}?sslmode=disable
      APP_ENV: ${APP_ENV:-development}
      GIN_MODE: ${GIN_MODE:-debug}
      ALLOW_DROP_TABLES: ${ALLOW_DROP_TABLES:-false}
      ADMIN_DROP_PASSWORD: ${ADMIN_DROP_PASSWORD:-1234}
      MINIO_ENDPOINT: minio:9000
      MINIO_ACCESS_KEY: ${MINIO_ACCESS_KEY:-minioadmin}
      MINIO_SECRET_KEY: ${MINIO_SECRET_KEY:-minioadmin}
      MINIO_BUCKET: ${MINIO_BUCKET:-ide-bestanden}
      MINIO_USE_SSL: "false"
    ports:
      - "${API_PORT:-8082}:8080"
    depends_on:
      postgres:
        condition: service_healthy
      minio:
        condition: service_healthy
    networks:
      - task_manager_network

volumes:
  postgres_data:
  minio_data:

networks:
  task_manager_network:
    driver: bridge
```

---

### Stap 3 — backend2 (pleio) compose — géén auto-start

> `frontend` is ook een one-shot container (kopieert bestanden en stopt) — die krijgt ook `"no"`. De rest krijgt expliciet `restart: "no"` zodat ze nooit vanzelf starten.

```yaml
services:

  nginx-proxy:
    image: nginxproxy/nginx-proxy:1.8
    restart: "no"
    ports:
      - "8000:80"
    environment:
      DEFAULT_HOST: localhost
    volumes:
      - /var/run/docker.sock:/tmp/docker.sock:ro
      - ./docker/vhost.d:/etc/nginx/vhost.d

  api:
    extends:
      file: docker-compose.extend.backend.yml
      service: backend
    restart: "no"
    environment:
      VIRTUAL_HOST: localhost
      VIRTUAL_PATH: /
      VIRTUAL_PORT: 8000
    depends_on:
      - db
      - nginx-proxy
      - background
      - redis
    profiles:
      - full
      - base

  background:
    extends:
      file: docker-compose.extend.backend.yml
      service: backend
    restart: "no"
    environment:
      CELERY_WORKER_MAX_TASKS_PER_CHILD: 100
    depends_on:
      - db
      - rabbitmq
      - elasticsearch
      - redis
    command: [ "/start-background.sh" ]

  admin:
    extends:
      file: docker-compose.extend.backend.yml
      service: backend
    restart: "no"
    environment:
      RUN_AS_ADMIN_APP: 'True'
    depends_on:
      - db
    ports:
      - "8888:8000"
    command: [ "/start-admin-dev.sh" ]
    profiles:
      - full
      - admin

  subscription-api:
    extends:
      file: docker-compose.extend.backend.yml
      service: backend
    restart: "no"
    environment:
      VIRTUAL_HOST: localhost
      VIRTUAL_PATH: /subscriptions
      VIRTUAL_PORT: 8989
    command: [ "/start-websocket.sh" ]
    depends_on:
      - db
      - rabbitmq
    profiles:
      - full
      - subscriptions

  frontend:
    image: registry.gitlab.com/pleio/frontend:${FRONTEND_IMAGE_TAG:-latest}
    restart: "no"
    volumes:
      - frontend-build:/shared
    command: sh -c "rm -Rf /shared/* && cp -Rp /usr/share/nginx/html/. /shared && chown -R www-data:www-data /shared 2>/dev/null || true"
    profiles:
      - full
      - frontend

  db:
    image: postgres:17.5
    restart: "no"
    environment:
      POSTGRES_PASSWORD: postgres
      LC_COLLATE: 'C.UTF-8'
      LC_CTYPE: 'C.UTF-8'
    ports:
      - 15432:5432
    volumes:
      - postgres_data:/var/lib/postgresql/data/
      - ./docker/db:/docker-entrypoint-initdb.d

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.19.2
    restart: "no"
    environment:
      - xpack.security.enabled=false
      - bootstrap.memory_lock=true
      - cluster.name=docker-cluster
      - cluster.routing.allocation.disk.threshold_enabled=false
      - discovery.type=single-node
      - http.max_content_length=10mb
      - ES_JAVA_OPTS=-Xms1g -Xmx1g
    ulimits:
      memlock:
        soft: -1
        hard: -1
    volumes:
      - esdata01:/usr/share/elasticsearch/data
    healthcheck:
      interval: 20s
      retries: 10
      test: curl -s http://localhost:9200/_cluster/health | grep -vq '"status":"red"'
    ports:
      - 19200:9200

  mailcatcher:
    image: dockage/mailcatcher:0.9.0
    restart: "no"
    ports:
      - "1080:1080"
    profiles:
      - full
      - mailcatcher

  rabbitmq:
    image: 'rabbitmq:3.13.7-management-alpine'
    restart: "no"
    ports:
      - '5672:5672'
      - '15672:15672'
    environment:
      AMQP_URL: 'amqp://localhost?connection_attempts=5&retry_delay=5'
      RABBITMQ_DEFAULT_USER: "guest"
      RABBITMQ_DEFAULT_PASS: "guest"

  redis:
    image: 'redis:6.2'
    restart: "no"
    ports:
      - '16379:6379'

  clamav:
    image: clamav/clamav-debian:1.4
    restart: "no"
    environment:
      CLAMD_CONF_FILE: /mnt/clamd.conf
    volumes:
      - ./docker/clamd.conf:/mnt/clamd.conf
    profiles:
      - full
      - clamav

  minio:
    image: minio/minio:latest
    restart: "no"
    ports:
      - '9010:9000'
      - '9011:9001'
    volumes:
      - './docker:/docker'
      - './media/minio:/data'
    environment:
      - MINIO_ROOT_USER=pleio_dev
      - MINIO_ROOT_PASSWORD=pleio_dev
      - MINIO_ACCESS_KEY=pleio_dev_key
      - MINIO_ACCESS_SECRET=pleio_dev_secret
    command: ["minio", "server", "/data", "--console-address", ":9001"]
    entrypoint: ["/docker/minio-start-dev.sh"]
    profiles:
      - full
      - minio

volumes:
  frontend-build:
  shared-tmp:
  postgres_data:
  esdata01:
    driver: local
```

---

Na plakken + `docker compose up -d` toepassen worden de restart-policies actief. De al-draaiende containers hoef je niet opnieuw te bouwen — een `docker compose up -d` past de policies bij.

---
