#!/bin/bash
set -e

# Initialiseer extra databases voor OpenFTV (ADL logging).
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE openftv_adl;
EOSQL
