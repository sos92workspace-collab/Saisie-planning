INSERT INTO users (trigram, password, role) VALUES ('SDN', 'Sandrine1234', 'STANDARDISTE') ON CONFLICT (trigram) DO UPDATE SET role = 'STANDARDISTE', password = 'Sandrine1234';
