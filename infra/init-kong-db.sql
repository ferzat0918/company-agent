-- Create the kong database if it doesn't already exist
SELECT 'CREATE DATABASE kong' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'kong')\gexec
