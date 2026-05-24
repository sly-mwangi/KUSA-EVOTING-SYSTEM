
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


DROP TABLE IF EXISTS audit_log              CASCADE;
DROP TABLE IF EXISTS votes                  CASCADE;
DROP TABLE IF EXISTS ballot_tokens          CASCADE;
DROP TABLE IF EXISTS endorsements           CASCADE;
DROP TABLE IF EXISTS election_application_settings CASCADE;
DROP TABLE IF EXISTS candidate_documents    CASCADE;
DROP TABLE IF EXISTS candidates             CASCADE;
DROP TABLE IF EXISTS poll_seats             CASCADE;
DROP TABLE IF EXISTS polls                  CASCADE;
DROP TABLE IF EXISTS otps                   CASCADE;
DROP TABLE IF EXISTS users                  CASCADE;
DROP TABLE IF EXISTS student_records        CASCADE;
DROP TABLE IF EXISTS courses                CASCADE;
DROP TABLE IF EXISTS departments            CASCADE;
DROP TABLE IF EXISTS schools                CASCADE;
DROP TABLE IF EXISTS hostels                CASCADE;

-- ============================================================
--  1. SCHOOLS
-- ============================================================
CREATE TABLE schools (
    id   TEXT PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

INSERT INTO schools (id, name) VALUES
    ('spas',   'School of Pure and Applied Sciences'),
    ('sb',     'School of Business'),
    ('se',     'School of Economics'),
    ('sea',    'School of Engineering and Architecture'),
    ('sed',    'School of Education'),
    ('sph',    'School of Public Health'),
    ('sol',    'School of Law'),
    ('shss',   'School of Humanities and Social Sciences'),
    ('sht',    'School of Hospitality and Tourism'),
    ('scafms', 'School of Creative Arts, Film & Media Studies'),
    ('svpa',   'School of Visual and Performing Arts'),
    ('som',    'School of Medicine'),
    ('ssdps',  'School of Security, Diplomacy and Peace Studies'),
    ('ses',    'School of Environmental Studies'),
    ('sahs',   'School of Applied Human Sciences'),
    ('saed',   'School of Agriculture and Enterprise Development');

-- ============================================================
--  2. DEPARTMENTS
-- ============================================================
CREATE TABLE departments (
    id        TEXT PRIMARY KEY,
    name      VARCHAR(255) NOT NULL,
    school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE
);

INSERT INTO departments (id, name, school_id) VALUES
    ('spas-computing-it',           'Computing & Information Technology',            'spas'),
    ('spas-mathematics-actuarial',  'Mathematics, Statistics & Actuarial Science',   'spas'),
    ('spas-physics',                'Physics',                                        'spas'),
    ('spas-chemistry',              'Chemistry',                                      'spas'),
    ('spas-biochem-micro-biotech',  'Biochemistry, Microbiology & Biotechnology',    'spas'),
    ('sb-business',                 'Department of Business Administration',          'sb'),
    ('se-economics',                'Department of Economics',                        'se'),
    ('sea-civil',                   'Civil & Construction Engineering',               'sea'),
    ('sea-electrical',              'Electrical & Electronic Engineering',            'sea'),
    ('sea-mechanical',              'Mechanical Engineering',                         'sea'),
    ('sed-education',               'Department of Education',                        'sed'),
    ('sph-community-health',        'Department of Community Health',                 'sph'),
    ('sph-health-management-informatics', 'Health Management & Informatics',          'sph'),
    ('sph-environmental-health',    'Environmental Health',                           'sph'),
    ('sol-public-private-law',      'Public & Private Law',                          'sol'),
    ('shss-psychology',             'Psychology',                                     'shss'),
    ('shss-sociology',              'Sociology',                                      'shss'),
    ('shss-geography',              'Geography',                                      'shss'),
    ('shss-history-archaeology',    'History & Archaeology',                          'shss'),
    ('shss-kiswahili',              'Kiswahili & African Languages',                  'shss'),
    ('sht-hospitality',             'Hospitality Management',                         'sht'),
    ('sht-tourism',                 'Tourism Management',                             'sht'),
    ('scafms-communication',        'Communication & Media Studies',                  'scafms'),
    ('svpa-theatre-film-tech',      'Theatre Arts & Film Technology',                 'svpa'),
    ('svpa-fine-art-design',        'Fine Art & Design',                              'svpa'),
    ('ssdps-conflict-peace',        'Conflict, Peace & Strategic Studies',            'ssdps'),
    ('ssdps-diplomacy',             'Diplomacy & International Relations',            'ssdps'),
    ('sahs-nutrition',              'Nutrition & Dietetics',                          'sahs'),
    ('sahs-fashion-design',         'Fashion Design & Marketing',                     'sahs'),
    ('saed-agriculture',            'Agriculture & Enterprise Development',           'saed');

-- ============================================================
--  3. COURSES
-- ============================================================
CREATE TABLE courses (
    id            TEXT PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    level         VARCHAR(20) NOT NULL DEFAULT 'bachelor'
);

INSERT INTO courses (id, name, department_id, level) VALUES
    ('bsc-computer-science',             'Bachelor of Science in Computer Science',                       'spas-computing-it',          'bachelor'),
    ('bsc-information-technology',       'Bachelor of Science in Information Technology',                 'spas-computing-it',          'bachelor'),
    ('dip-it-cs',                        'Diploma in IT / Computer Science',                              'spas-computing-it',          'diploma'),
    ('bsc-mathematics',                  'BSc Mathematics',                                               'spas-mathematics-actuarial', 'bachelor'),
    ('bsc-statistics',                   'BSc Statistics',                                                'spas-mathematics-actuarial', 'bachelor'),
    ('bsc-actuarial-science',            'BSc Actuarial Science',                                         'spas-mathematics-actuarial', 'bachelor'),
    ('bsc-physics',                      'Bachelor of Science in Physics',                                'spas-physics',               'bachelor'),
    ('bsc-chemistry',                    'Bachelor of Science in Chemistry',                              'spas-chemistry',             'bachelor'),
    ('bsc-biochemistry',                 'Bachelor of Science in Biochemistry',                           'spas-biochem-micro-biotech', 'bachelor'),
    ('bsc-microbiology',                 'Bachelor of Science in Microbiology',                           'spas-biochem-micro-biotech', 'bachelor'),
    ('bsc-biotechnology',                'Bachelor of Science in Biotechnology',                          'spas-biochem-micro-biotech', 'bachelor'),
    ('bba-business-administration',      'Bachelor of Business Administration',                           'sb-business',                'bachelor'),
    ('bcom-accounting',                  'Bachelor of Commerce (Accounting)',                             'sb-business',                'bachelor'),
    ('ba-economics',                     'Bachelor of Arts in Economics',                                 'se-economics',               'bachelor'),
    ('bsc-civil-engineering',            'Bachelor of Science in Civil Engineering',                      'sea-civil',                  'bachelor'),
    ('bsc-electrical-engineering',       'Bachelor of Science in Electrical Engineering',                 'sea-electrical',             'bachelor'),
    ('bsc-mechanical-engineering',       'Bachelor of Science in Mechanical Engineering',                 'sea-mechanical',             'bachelor'),
    ('bed-science',                      'Bachelor of Education (Science)',                               'sed-education',              'bachelor'),
    ('bed-arts',                         'Bachelor of Education (Arts)',                                  'sed-education',              'bachelor'),
    ('bsc-community-health-development', 'Bachelor of Science in Community Health and Development',       'sph-community-health',       'bachelor'),
    ('bsc-health-records-information',   'Bachelor of Science in Health Records and Information Mgmt',   'sph-health-management-informatics', 'bachelor'),
    ('bsc-environmental-health',         'Bachelor of Science in Environmental Health',                   'sph-environmental-health',   'bachelor'),
    ('llb',                              'Bachelor of Laws (LLB)',                                        'sol-public-private-law',     'bachelor'),
    ('ba-psychology',                    'Bachelor of Arts in Psychology',                                'shss-psychology',            'bachelor'),
    ('ba-sociology',                     'Bachelor of Arts in Sociology',                                 'shss-sociology',             'bachelor'),
    ('ba-geography',                     'Bachelor of Arts in Geography',                                 'shss-geography',             'bachelor'),
    ('bsc-hospitality-management',       'Bachelor of Science in Hospitality Management',                 'sht-hospitality',            'bachelor'),
    ('bsc-tourism-management',           'Bachelor of Science in Tourism Management',                     'sht-tourism',                'bachelor'),
    ('ba-communication-media-studies',   'Bachelor of Arts in Communication and Media Studies',          'scafms-communication',       'bachelor'),
    ('ba-peace-conflict-studies',        'Bachelor of Arts in Peace and Conflict Studies',                'ssdps-conflict-peace',       'bachelor');

-- ============================================================
--  4. HOSTELS
-- ============================================================
CREATE TABLE hostels (
    id     TEXT PRIMARY KEY,
    name   VARCHAR(255) NOT NULL,
    zone   VARCHAR(50) NOT NULL,
    gender VARCHAR(10) NOT NULL
);

INSERT INTO hostels (id, name, zone, gender) VALUES
    -- Male (Eastern)
    ('h-mfumbiro',        'Mfumbiro Hostel',         'eastern', 'male'),
    ('h-nyandarua',       'Nyandarua Hostel',         'eastern', 'male'),
    ('h-old-menengai-4',  'Old Menengai 4 Hostel',   'eastern', 'male'),
    ('h-old-menengai-5',  'Old Menengai 5 Hostel',   'eastern', 'male'),
    ('h-old-menengai-6',  'Old Menengai 6 Hostel',   'eastern', 'male'),
    -- Female (Eastern)
    ('h-old-menengai-1',  'Old Menengai 1 Hostel',   'eastern', 'female'),
    ('h-old-menengai-2',  'Old Menengai 2 Hostel',   'eastern', 'female'),
    ('h-old-menengai-3',  'Old Menengai 3 Hostel',   'eastern', 'female'),
    ('h-new-menengai',    'New Menengai Hostel',      'eastern', 'female'),
    ('h-new-aberdares',   'New Aberdares Hostel',     'eastern', 'female'),
    ('h-old-aberdares',   'Old Aberdares Hostel',     'eastern', 'female'),
    -- Male (Western)
    ('h-new-ruwenzori',   'New Ruwenzori Hostel',     'western', 'male'),
    ('h-longonot',        'Longonot Hostel',           'western', 'male'),
    ('h-kilimambogo',     'Kilimambogo Hostel',        'western', 'male'),
    ('h-usambara-2',      'Usambara Block 2',          'western', 'male'),
    ('h-usambara-3',      'Usambara Block 3',          'western', 'male'),
    ('h-usambara-4',      'Usambara Block 4',          'western', 'male'),
    ('h-usambara-5',      'Usambara Block 5',          'western', 'male'),
    -- Female (Western)
    ('h-ngong',           'Ngong Hostel',               'western', 'female'),
    ('h-lukenya',         'Lukenya Hostel',             'western', 'female'),
    ('h-usambara-1',      'Usambara Block 1',           'western', 'female'),
    ('h-old-ruwenzori',   'Old Ruwenzori Hostel',       'western', 'female'),
    -- Female (Nyayo)
    ('h-nyayo-one',       'Nyayo One',                  'nyayo',   'female'),
    ('h-nyayo-two',       'Nyayo Two',                  'nyayo',   'female'),
    ('h-nyayo-five',      'Nyayo Five',                 'nyayo',   'female'),
    ('h-nyayo-six',       'Nyayo Six',                  'nyayo',   'female'),
    -- Male (Nyayo)
    ('h-nyayo-three',     'Nyayo Three',                'nyayo',   'male'),
    ('h-nyayo-four',      'Nyayo Four',                 'nyayo',   'male'),
    ('h-nyayo-flats',     'Nyayo Flats',                'nyayo',   'male');

-- ============================================================
--  5. STUDENT RECORDS
--     Registration number is the PRIMARY KEY.
--     Only students in this table with fee_balance = 0 may register.
-- ============================================================
CREATE TABLE student_records (
    registration_number VARCHAR(50) PRIMARY KEY,
    name                VARCHAR(255) NOT NULL,
    email               VARCHAR(255) NOT NULL UNIQUE,
    gender              VARCHAR(10) NOT NULL CHECK (gender IN ('male','female')),
    school_id           TEXT NOT NULL REFERENCES schools(id),
    department_id       TEXT NOT NULL REFERENCES departments(id),
    course_id           TEXT NOT NULL REFERENCES courses(id),
    hostel_id           TEXT REFERENCES hostels(id),
    year_of_study       INTEGER NOT NULL DEFAULT 1 CHECK (year_of_study BETWEEN 1 AND 6),
    fee_balance         NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 30 Sample Student Records ──────────────────────────────


INSERT INTO student_records
    fee_balance         NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 30 Sample Student Records ──────────────────────────────


INSERT INTO student_records
    (registration_number, name, email, gender, school_id, department_id, course_id, hostel_id, year_of_study, fee_balance)
VALUES
-- ELIGIBLE (fee_balance = 0.00)
('J31/0001/2021', 'John Mwangi Kamau',        '0001.2021@students.ku.ac.ke',  'male',   'spas',   'spas-computing-it',          'bsc-computer-science',             'h-mfumbiro',      3, 0.00),
('J31/0002/2021', 'Jane Wanjiku Njoroge',     '0002.2021@students.ku.ac.ke',  'female', 'spas',   'spas-computing-it',          'bsc-information-technology',       'h-old-menengai-1',3, 0.00),
('J31/0003/2022', 'David Otieno Omondi',      '0003.2022@students.ku.ac.ke',  'male',   'spas',   'spas-mathematics-actuarial', 'bsc-mathematics',                  'h-nyandarua',     2, 0.00),
('J31/0004/2022', 'Mary Nyambura Githua',     '0004.2022@students.ku.ac.ke',  'female', 'spas',   'spas-chemistry',             'bsc-chemistry',                    'h-new-aberdares', 2, 0.00),
('J31/0005/2020', 'Peter Kamau Njuguna',      '0005.2020@students.ku.ac.ke',  'male',   'sb',     'sb-business',                'bba-business-administration',      NULL,              4, 0.00),
('J31/0006/2020', 'Grace Wacera Maina',       '0006.2020@students.ku.ac.ke',  'female', 'sph',    'sph-community-health',       'bsc-community-health-development', 'h-nyayo-one',     4, 0.00),
('J31/0007/2022', 'Samuel Kipchoge Rono',     '0007.2022@students.ku.ac.ke',  'male',   'sea',    'sea-civil',                  'bsc-civil-engineering',            'h-kilimambogo',   2, 0.00),
('J31/0008/2021', 'Agnes Akinyi Otieno',      '0008.2021@students.ku.ac.ke',  'female', 'ssdps',  'ssdps-conflict-peace',       'ba-peace-conflict-studies',        'h-nyayo-five',    3, 0.00),
('J31/0009/2023', 'Michael Njenga Kariuki',   '0009.2023@students.ku.ac.ke',  'male',   'spas',   'spas-computing-it',          'bsc-computer-science',             'h-nyayo-three',   1, 0.00),
('J31S/0010/2022','Esther Chebet Koech',      '0010.2022@students.ku.ac.ke',  'female', 'spas',   'spas-biochem-micro-biotech', 'bsc-biochemistry',                 'h-lukenya',       2, 0.00),
('J31/0011/2021', 'Daniel Muthoni Muriuki',   '0011.2021@students.ku.ac.ke',  'male',   'spas',   'spas-physics',               'bsc-physics',                      'h-usambara-2',    3, 0.00),
('J31/0012/2022', 'Ruth Waithaka Gicheru',    '0012.2022@students.ku.ac.ke',  'female', 'se',     'se-economics',               'ba-economics',                     'h-old-menengai-2',2, 0.00),
('J31/0013/2020', 'Joseph Owino Adhiambo',    '0013.2020@students.ku.ac.ke',  'male',   'sol',    'sol-public-private-law',     'llb',                              NULL,              4, 0.00),
('J31S/0014/2021','Charity Ndungu Wangari',   '0014.2021@students.ku.ac.ke',  'female', 'sed',    'sed-education',              'bed-arts',                         'h-nyayo-six',     3, 0.00),
('J31/0015/2023', 'Isaac Mutua Nzomo',        '0015.2023@students.ku.ac.ke',  'male',   'spas',   'spas-biochem-micro-biotech', 'bsc-microbiology',                 'h-longonot',      1, 0.00),
('J31/0016/2022', 'Priscilla Moraa Onsarigo', '0016.2022@students.ku.ac.ke',  'female', 'sahs',   'sahs-nutrition',             'bsc-community-health-development', 'h-old-aberdares', 2, 0.00),
('J31S/0017/2021','Emmanuel Wafula Simiyu',   '0017.2021@students.ku.ac.ke',  'male',   'svpa',   'svpa-theatre-film-tech',     'bsc-computer-science',             'h-mfumbiro',      3, 0.00),
('J31/0018/2022', 'Beatrice Auma Odhiambo',   '0018.2022@students.ku.ac.ke',  'female', 'scafms', 'scafms-communication',       'ba-communication-media-studies',   'h-ngong',         2, 0.00),
('J31/0019/2020', 'Alex Gitonga Mureithi',    '0019.2020@students.ku.ac.ke',  'male',   'spas',   'spas-mathematics-actuarial', 'bsc-statistics',                   NULL,              4, 0.00),
('J31/0020/2021', 'Caroline Wambui Mwangi',   '0020.2021@students.ku.ac.ke',  'female', 'sph',    'sph-health-management-informatics','bsc-health-records-information','h-nyayo-two',  3, 0.00),
('J31/0021/2022', 'Vincent Ochieng Ouma',     '0021.2022@students.ku.ac.ke',  'male',   'ssdps',  'ssdps-diplomacy',            'ba-peace-conflict-studies',        'h-usambara-3',    2, 0.00),
('J31S/0022/2023','Dorothy Kioni Murithi',    '0022.2023@students.ku.ac.ke',  'female', 'ssdps',  'ssdps-diplomacy',            'ba-peace-conflict-studies',        'h-usambara-1',    1, 0.00),
('J31/0023/2021', 'George Maina Kamande',     '0023.2021@students.ku.ac.ke',  'male',   'spas',   'spas-mathematics-actuarial', 'bsc-actuarial-science',            'h-old-menengai-4',3, 0.00),
('J31/0024/2022', 'Mercy Njeri Waweru',       '0024.2022@students.ku.ac.ke',  'female', 'shss',   'shss-geography',             'ba-geography',                     'h-old-menengai-3',2, 0.00),
('J31/0025/2020', 'Brian Kipkoech Mutai',     '0025.2020@students.ku.ac.ke',  'male',   'sht',    'sht-tourism',                'bsc-tourism-management',           NULL,              4, 0.00),

-- NOT ELIGIBLE (fee_balance > 0 — blocked from registering)
('J31/0026/2022', 'Felix Odhiambo Were',      '0026.2022@students.ku.ac.ke',  'male',   'spas',   'spas-biochem-micro-biotech', 'bsc-biotechnology',                'h-usambara-4',    2, 15000.00),
('J31/0027/2021', 'Purity Njambi Kamau',      '0027.2021@students.ku.ac.ke',  'female', 'shss',   'shss-psychology',            'ba-psychology',                    'h-new-menengai',  3, 28500.00),
('J31S/0028/2023','Kevin Mwenda Nthiga',      '0028.2023@students.ku.ac.ke',  'male',   'sea',    'sea-mechanical',             'bsc-mechanical-engineering',       'h-nyayo-four',    1, 42000.00),
('J31/0029/2022', 'Lilian Wanjiku Kimani',    '0029.2022@students.ku.ac.ke',  'female', 'sahs',   'sahs-fashion-design',        'bsc-community-health-development', 'h-nyayo-five',    2, 9800.00),
('J31/0030/2021', 'Hassan Abdi Mohamed',      '0030.2021@students.ku.ac.ke',  'male',   'sph',    'sph-environmental-health',   'bsc-environmental-health',         NULL,              3, 33000.00);

-- ============================================================
--  6. USERS  (created when a student successfully registers)
-- ============================================================
CREATE TABLE users (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    VARCHAR(255) NOT NULL,
    email                   VARCHAR(255) NOT NULL UNIQUE,
    password_hash           TEXT NOT NULL,
    role                    VARCHAR(50)  NOT NULL DEFAULT 'student',
    status                  VARCHAR(50)  NOT NULL DEFAULT 'pending_otp',
    gender                  VARCHAR(10),
    course_id               TEXT,
    hostel_id               TEXT,
    registration_number     VARCHAR(50),
    registration_expires_at TIMESTAMPTZ,
    fee_status              VARCHAR(20),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default admin account (password: Admin123)
-- Password hash below is bcrypt of "Admin123"
INSERT INTO users (name, email, password_hash, role, status)
VALUES (
    'KUVOTE Administrator',
    'admin@ku.ac.ke',
    'scrypt$3e198f0097e94345f1096e7aaa43fe23$4016afd3d9ec9983ea91b96f50762b02d72242e8271e2780c7fe827db6e6cae686778ed06dc15a67ae60f59e36beb473eb6abd7d06b1e634b041b409a5f3162d',
    'admin',
    'active'
);

-- ============================================================
--  7. OTPs
-- ============================================================
CREATE TABLE otps (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) NOT NULL,
    code_hash   TEXT NOT NULL,
    purpose     VARCHAR(50) NOT NULL CHECK (purpose IN ('registration','password_reset')),
    expires_at  TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ
);

-- ============================================================
--  8. POLLS
-- ============================================================
CREATE TABLE polls (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       VARCHAR(255) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    poll_type   VARCHAR(20) NOT NULL DEFAULT 'general',
    start_date  TIMESTAMPTZ NOT NULL,
    end_date    TIMESTAMPTZ NOT NULL,
    locked      BOOLEAN NOT NULL DEFAULT FALSE,
    created_by  UUID NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
--  9. POLL SEATS
-- ============================================================
CREATE TABLE poll_seats (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id     UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    code        VARCHAR(100) NOT NULL,
    label       VARCHAR(255) NOT NULL,
    scope       VARCHAR(50) NOT NULL,
    scope_ref_id TEXT,
    gender      VARCHAR(10),
    position    INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- 10. CANDIDATES
-- ============================================================
CREATE TABLE candidates (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id          UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    seat_id          UUID NOT NULL REFERENCES poll_seats(id) ON DELETE CASCADE,
    user_id          UUID NOT NULL REFERENCES users(id),
    manifesto        TEXT NOT NULL,
    slogan           VARCHAR(255),
    bio              TEXT,
    photo_url        TEXT,
    status           VARCHAR(50) NOT NULL DEFAULT 'pending',
    rejection_reason TEXT,
    reviewed_by      UUID REFERENCES users(id),
    reviewed_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 11. CANDIDATE DOCUMENTS
-- ============================================================
CREATE TABLE candidate_documents (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id  UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    document_name VARCHAR(255) NOT NULL,
    document_url  TEXT NOT NULL,
    document_type VARCHAR(100) NOT NULL DEFAULT 'document',
    uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 12. ELECTION APPLICATION SETTINGS
-- ============================================================
CREATE TABLE election_application_settings (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id               UUID NOT NULL UNIQUE REFERENCES polls(id) ON DELETE CASCADE,
    is_open               BOOLEAN NOT NULL DEFAULT FALSE,
    open_at               TIMESTAMPTZ,
    close_at              TIMESTAMPTZ,
    timer_duration_minutes INTEGER,
    opened_by             UUID REFERENCES users(id),
    closed_by             UUID REFERENCES users(id),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 13. ENDORSEMENTS
-- ============================================================
CREATE TABLE endorsements (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    seat_id      UUID NOT NULL REFERENCES poll_seats(id),
    voter_id     UUID NOT NULL REFERENCES users(id)
);

-- ============================================================
-- 14. BALLOT TOKENS
-- ============================================================
CREATE TABLE ballot_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id     UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    seat_id     UUID NOT NULL REFERENCES poll_seats(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id),
    token_hash  TEXT NOT NULL,
    used        BOOLEAN NOT NULL DEFAULT FALSE,
    used_at     TIMESTAMPTZ
);

-- ============================================================
-- 15. VOTES
-- ============================================================
CREATE TABLE votes (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id           UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    seat_id           UUID NOT NULL REFERENCES poll_seats(id),
    candidate_id      UUID NOT NULL REFERENCES candidates(id),
    encrypted_payload TEXT NOT NULL,
    ballot_hash       TEXT NOT NULL,
    token_hash        TEXT NOT NULL,
    voted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 16. AUDIT LOG
-- ============================================================
CREATE TABLE audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action      VARCHAR(100) NOT NULL,
    actor_email VARCHAR(255),
    actor_role  VARCHAR(50),
    target      VARCHAR(255),
    details     TEXT,
    ip_address  VARCHAR(45),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
--  INDEXES (performance)
-- ============================================================
CREATE INDEX idx_student_records_email        ON student_records(email);
CREATE INDEX idx_users_email                  ON users(email);
CREATE INDEX idx_users_registration_number    ON users(registration_number);
CREATE INDEX idx_otps_email_purpose           ON otps(email, purpose);
CREATE INDEX idx_candidates_poll_id           ON candidates(poll_id);
CREATE INDEX idx_candidates_user_id           ON candidates(user_id);
CREATE INDEX idx_votes_poll_seat              ON votes(poll_id, seat_id);
CREATE INDEX idx_ballot_tokens_user_poll      ON ballot_tokens(user_id, poll_id);
CREATE INDEX idx_audit_log_created_at         ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_actor_email        ON audit_log(actor_email);

-- ============================================================
--  VERIFICATION QUERIES
-- ============================================================
Check eligible students (fee_balance = 0):
  SELECT registration_number, name, email FROM student_records WHERE fee_balance = 0;
 Check blocked students (outstanding balance):
   SELECT registration_number, name, fee_balance FROM student_records WHERE fee_balance > 0;

 Check registered accounts:
   SELECT u.email, u.status, sr.fee_balance
   FROM users u
   LEFT JOIN student_records sr ON sr.registration_number = u.registration_number
  WHERE u.role = 'student';

-- ============================================================
--  END OF SCRIPT
-- ============================================================
