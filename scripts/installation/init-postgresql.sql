-- ============================================================
-- Initialisation PostgreSQL — Plateforme LBH
-- Script exécuté au premier démarrage du conteneur lbh-postgresql
-- ============================================================

-- Activation de l'extension PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Création des schémas métier
CREATE SCHEMA IF NOT EXISTS principal;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS documents;

-- Configuration des droits sur les schémas
-- (L'utilisateur lbh_appli est créé par les variables d'environnement Docker)
-- Ces commandes s'exécutent après la création de la base et de l'utilisateur
DO $$
BEGIN
    -- Vérifier si l'utilisateur existe avant de lui donner des droits
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user) THEN
        GRANT ALL ON SCHEMA principal TO CURRENT_USER;
        GRANT ALL ON SCHEMA audit TO CURRENT_USER;
        GRANT ALL ON SCHEMA documents TO CURRENT_USER;
        ALTER USER CURRENT_USER SET search_path TO principal, public;
    END IF;
END $$;

-- Commentaires sur les schémas
COMMENT ON SCHEMA principal IS 'Schéma principal de la Plateforme LBH — Bureau d''Études Économiste';
COMMENT ON SCHEMA audit IS 'Schéma d''audit — journalisation des modifications';
COMMENT ON SCHEMA documents IS 'Schéma documentaire — indexation et métadonnées';

-- Configuration de la locale française pour les tris
SET lc_messages = 'fr_FR.UTF-8';
