# BizPermit — Redis Key Design & Caching Architecture

## 1. Key Taxonomy & Namespace Structure
All keys in BizPermit are namespaced with the standard prefix `bizpermit:` to avoid key collisions across Redis/Memurai instances.

| Key Pattern | Description | Data Type | Default TTL | Invalidation Trigger |
|---|---|---|---|---|
| `bizpermit:license-catalog:v1` | Full catalog of active license types and associated departments | String (JSON) | 600s (10 min) | Admin adds/edits license types or categories |
| `bizpermit:license:<id>:details` | Deep detail of a specific license type with rules and requirements | String (JSON) | 300s (5 min) | Admin updates license master details or requirements |
| `bizpermit:dashboard:admin` | Aggregated system metrics (total users, active licenses, SLAs) | String (JSON) | 60s (1 min) | Any application status transition or new filing |
| `bizpermit:dashboard:owner:<userId>` | Owner personalized dashboard overview & counts | String (JSON) | 60s (1 min) | Owner creates/submits application or officer reviews it |
| `bizpermit:verify:<email>` | Temporary single-use OTP challenge for password reset | String (JSON) | 300s (5 min) | Consumed upon verification or expires |
| `bizpermit:ratelimit:<ip>` | Sliding window IP rate-limiting tracking | Integer / Hash | 60s | Automatically managed by rate limiter |

## 2. Invalidation Strategy
- **Master Data Changes:** Triggered via `redisService.invalidateAllLicenseCaches()`.
- **Workflow State Changes:** Triggered via `redisService.invalidateWorkflowCaches(ownerId)`.
- **Fault-Tolerant Fallback:** In the event of a cache miss or if Redis is temporarily unavailable, services automatically fall back to querying MySQL/MongoDB directly without disrupting the user experience.
