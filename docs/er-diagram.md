# BizPermit — Entity Relationship (ER) & Multi-Model Database Schema

BizPermit incorporates a **4-way Multi-Model Database Architecture** engineered for optimal academic DBMS rigor:
- **MySQL 8.0**: Relational source of truth for ACID transactions, role-based identity, application status machine, audit logs, and accounting.
- **MongoDB 7.0**: Flexible JSON document store for heterogeneous form submissions (`application_form_responses`) and multi-point audit checklists with GPS/evidence metadata (`inspection_reports`).
- **Neo4j 5.20**: Graph database for hierarchical license prerequisites, cross-department dependencies (`DEPENDS_ON`), and sector discovery (`MAY_REQUIRE`).
- **Redis 7.2**: High-throughput in-memory cache for catalog queries, session state verification, and dashboard metric acceleration.

---

## 1. Relational ER Diagram (MySQL)

```mermaid
erDiagram
    USERS ||--o{ USER_ROLES : has
    ROLES ||--o{ USER_ROLES : assigned
    USERS ||--o{ BUSINESSES : owns
    BUSINESS_CATEGORIES ||--o{ BUSINESSES : categorizes
    DEPARTMENTS ||--o{ STAFF_DEPARTMENTS : employs
    USERS ||--o{ STAFF_DEPARTMENTS : member
    DEPARTMENTS ||--o{ LICENSE_TYPES : administers
    LICENSE_TYPES ||--o{ LICENSE_TYPE_CATEGORIES : mapped
    BUSINESS_CATEGORIES ||--o{ LICENSE_TYPE_CATEGORIES : contains
    LICENSE_TYPES ||--o{ LICENSE_REQUIREMENTS : defines
    BUSINESSES ||--o{ APPLICATIONS : files
    LICENSE_TYPES ||--o{ APPLICATIONS : for
    APPLICATIONS ||--o{ APPLICATION_ASSIGNMENTS : assigned
    USERS ||--o{ APPLICATION_ASSIGNMENTS : evaluates
    APPLICATIONS ||--o{ APPLICATION_DOCUMENTS : includes
    APPLICATIONS ||--o{ PAYMENTS : pays
    APPLICATIONS ||--o{ INSPECTIONS : audited_by
    USERS ||--o{ INSPECTIONS : conducts
    APPLICATIONS ||--o{ ISSUED_LICENSES : issues
    USERS ||--o{ NOTIFICATIONS : receives
    USERS ||--o{ AUDIT_LOGS : triggers

    USERS {
        int id PK
        varchar email UK
        varchar password_hash
        varchar full_name
        varchar phone
        boolean is_active
        datetime created_at
        datetime updated_at
    }

    ROLES {
        int id PK
        varchar name UK
        varchar description
    }

    USER_ROLES {
        int user_id PK,FK
        int role_id PK,FK
    }

    BUSINESS_CATEGORIES {
        int id PK
        varchar code UK
        varchar name
        text description
        boolean is_active
    }

    BUSINESSES {
        int id PK
        int owner_id FK
        int category_id FK
        varchar registration_number UK
        varchar name
        varchar trade_name
        text registered_address
        varchar city
        varchar postal_code
        varchar contact_email
        varchar contact_phone
        date established_date
        datetime created_at
    }

    DEPARTMENTS {
        int id PK
        varchar code UK
        varchar name
        varchar contact_email
        varchar contact_phone
        varchar office_location
        boolean is_active
        datetime created_at
    }

    STAFF_DEPARTMENTS {
        int id PK
        int user_id FK
        int department_id FK
        varchar designation
        datetime assigned_at
    }

    LICENSE_TYPES {
        int id PK
        varchar code UK
        varchar name
        int department_id FK
        decimal fee
        int validity_months
        int processing_sla_days
        boolean requires_inspection
        text description
        text eligibility_criteria
        boolean is_active
        datetime created_at
    }

    LICENSE_TYPE_CATEGORIES {
        int license_type_id PK,FK
        int category_id PK,FK
    }

    LICENSE_REQUIREMENTS {
        int id PK
        int license_type_id FK
        varchar requirement_code
        varchar title
        text description
        varchar document_type
        boolean is_mandatory
        varchar allowed_extensions
    }

    APPLICATIONS {
        int id PK
        varchar application_number UK
        int business_id FK
        int license_type_id FK
        enum status
        enum application_type
        int parent_license_id FK
        text officer_remarks
        datetime submitted_at
        datetime decided_at
        datetime created_at
        datetime updated_at
    }

    APPLICATION_ASSIGNMENTS {
        int id PK
        int application_id FK
        int assigned_to FK
        int assigned_by FK
        varchar role_type
        text notes
        datetime assigned_at
    }

    APPLICATION_DOCUMENTS {
        int id PK
        int application_id FK
        varchar requirement_code
        varchar original_filename
        varchar storage_key
        varchar mime_type
        bigint file_size_bytes
        enum verification_status
        text review_notes
        int verified_by FK
        datetime verified_at
        datetime uploaded_at
    }

    PAYMENTS {
        int id PK
        int application_id FK
        varchar transaction_reference UK
        decimal amount
        enum payment_method
        enum status
        datetime paid_at
        datetime created_at
    }

    INSPECTIONS {
        int id PK
        int application_id FK
        int inspector_id FK
        date scheduled_date
        datetime conducted_at
        enum outcome
        text notes
        datetime created_at
    }

    ISSUED_LICENSES {
        int id PK
        varchar license_number UK
        int application_id FK
        int business_id FK
        int license_type_id FK
        date issue_date
        date expiry_date
        varchar qr_verification_code UK
        enum status
        datetime created_at
    }

    NOTIFICATIONS {
        int id PK
        int user_id FK
        varchar title
        text message
        varchar type
        varchar action_url
        boolean is_read
        datetime created_at
    }

    AUDIT_LOGS {
        bigint id PK
        int user_id FK
        varchar action
        varchar entity_type
        varchar entity_id
        json payload
        varchar ip_address
        datetime created_at
    }
```

---

## 2. Polyglot Multi-Database Schema Mapping

### A. MongoDB Document Collections

MongoDB handles schema-free polymorphic documents where requirements differ drastically between sectors (e.g., cold storage temperature logs vs. software export certificates).

#### 1. `application_form_responses`
- **Key Ref**: `applicationId: Integer` (indexed, maps to MySQL `applications.id`)
- **Schema**:
```json
{
  "_id": "ObjectId('67c1e5a...')",
  "applicationId": 14,
  "businessId": 2,
  "formData": {
    "proposedCapacityKVA": 450,
    "hazardousMaterialClassification": "CLASS_B",
    "shiftOperations": ["MORNING", "NIGHT"],
    "effluentDischargeLitersPerDay": 12000,
    "zoningClearanceId": "ZN-2026-9921"
  },
  "submittedAt": "2026-10-30T14:32:00.000Z",
  "version": 1
}
```

#### 2. `inspection_reports`
- **Key Ref**: `inspectionId: Integer` (indexed, maps to MySQL `inspections.id`)
- **Schema**:
```json
{
  "_id": "ObjectId('67c1e8b...')",
  "inspectionId": 5,
  "applicationId": 14,
  "inspectorId": 3,
  "checklist": [
    {
      "itemId": "INSP-01",
      "title": "Premises Structural & Life Safety Verification",
      "status": "PASS",
      "remarks": "Load bearing columns intact. Clearance certified."
    },
    {
      "itemId": "INSP-02",
      "title": "Emergency Egress & Exit Route Clearance",
      "status": "PASS",
      "remarks": "Illuminated signs functional, doors push-bar equipped."
    },
    {
      "itemId": "INSP-03",
      "title": "Fire Extinguisher & First-Aid Provision",
      "status": "PASS",
      "remarks": "10 ABC dry powder cylinders inspected. Hydrant pressurized."
    }
  ],
  "evidenceMetadata": [
    {
      "type": "PHOTO",
      "caption": "Main entry hydrant pressure gauge",
      "filename": "hydrant_gauge_verified.jpg",
      "timestamp": "2026-10-30T15:10:00.000Z"
    }
  ],
  "remarks": "Facility complies fully with municipal safety code.",
  "completedAt": "2026-10-30T15:15:22.000Z"
}
```

---

### B. Neo4j Graph Model

The Neo4j graph models municipal regulatory relationships that would cause expensive recursive joins in SQL:

```mermaid
graph TD
    BC[BusinessCategory] -->|MAY_REQUIRE| LT[LicenseType]
    LT -->|HANDLED_BY| D[Department]
    LT -->|DEPENDS_ON| DEP[LicenseType (Prerequisite)]
    LT -->|NEEDS_DOCUMENT| DT[DocumentType]

    style BC fill:#7c3aed,stroke:#fff,color:#fff
    style LT fill:#006B61,stroke:#fff,color:#fff
    style D fill:#2563eb,stroke:#fff,color:#fff
    style DEP fill:#ef4444,stroke:#fff,color:#fff
    style DT fill:#059669,stroke:#fff,color:#fff
```

**Cypher Query Example (Dependency Resolution):**
```cypher
MATCH (target:LicenseType {code: "FSSAI-R2"})
MATCH (target)-[:DEPENDS_ON*1..3]->(prereq:LicenseType)
RETURN prereq.code, prereq.name;
```

---

### C. Redis Key-Value Architecture

Redis accelerates read-intensive endpoints and maintains distributed caches:

| Key Pattern | Data Structure | TTL | Purpose |
|-------------|----------------|-----|---------|
| `catalog:all` | JSON String | 1 Hour | Cached list of all active license types |
| `catalog:license:<id>` | JSON String | 1 Hour | Single license specification with requirements |
| `admin:dashboard` | JSON String | 5 Minutes | Aggregated metrics, queue counts, and monthly volumes |
| `cache:auth:<tokenHash>` | Hash | 24 Hours | Session token invalidation & user payload caching |
| `rate:limit:<ip>` | String / Counter | 1 Minute | Brute-force and API throttling protection |
