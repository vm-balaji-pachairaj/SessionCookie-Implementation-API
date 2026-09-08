"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateToPolicyBundles = migrateToPolicyBundles;
var path = require("path");
var dotenv_1 = require("dotenv");
var pg_1 = require("pg");
(0, dotenv_1.config)({ path: path.join(__dirname, '..', '.env') });
function migrateToPolicyBundles() {
    return __awaiter(this, void 0, void 0, function () {
        var databaseUrl, client, pPolicies, p2Policies, p3Policies, pSet, p2Set, p3Set, gRows, rolePoliciesMap, _i, _a, row, role, target, _b, _c, _d, role, targets, bundleName, bundleDesc, bundleRes, bundleId, _e, targets_1, target, ptype, roleNames, deleteResult, ruleCounts, bundleCount, bundlePolicyCount;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    databaseUrl = process.env.DATABASE_URL;
                    if (!databaseUrl) {
                        throw new Error('DATABASE_URL is not set');
                    }
                    client = new pg_1.Client({ connectionString: databaseUrl });
                    return [4 /*yield*/, client.connect()];
                case 1:
                    _f.sent();
                    _f.label = 2;
                case 2:
                    _f.trys.push([2, , 22, 24]);
                    console.log('Starting migration to Policy Bundle architecture...');
                    return [4 /*yield*/, client.query("SELECT DISTINCT v0 as name FROM casbin.casbin_rule WHERE ptype = 'p' AND v0 IS NOT NULL;")];
                case 3:
                    pPolicies = _f.sent();
                    return [4 /*yield*/, client.query("SELECT DISTINCT v0 as name FROM casbin.casbin_rule WHERE ptype = 'p2' AND v0 IS NOT NULL;")];
                case 4:
                    p2Policies = _f.sent();
                    return [4 /*yield*/, client.query("SELECT DISTINCT v0 as name FROM casbin.casbin_rule WHERE ptype = 'p3' AND v0 IS NOT NULL;")];
                case 5:
                    p3Policies = _f.sent();
                    pSet = new Set(pPolicies.rows.map(function (r) { return r.name; }));
                    p2Set = new Set(p2Policies.rows.map(function (r) { return r.name; }));
                    p3Set = new Set(p3Policies.rows.map(function (r) { return r.name; }));
                    return [4 /*yield*/, client.query("SELECT id, v0 as role, v1 as target FROM casbin.casbin_rule WHERE ptype = 'g' AND v0 IS NOT NULL AND v1 IS NOT NULL;")];
                case 6:
                    gRows = _f.sent();
                    console.log("Found ".concat(gRows.rows.length, " direct 'g' rule(s) in casbin_rule."));
                    rolePoliciesMap = new Map();
                    for (_i = 0, _a = gRows.rows; _i < _a.length; _i++) {
                        row = _a[_i];
                        role = row.role;
                        target = row.target;
                        if (!rolePoliciesMap.has(role)) {
                            rolePoliciesMap.set(role, new Set());
                        }
                        rolePoliciesMap.get(role).add(target);
                    }
                    console.log("Found ".concat(rolePoliciesMap.size, " role(s) with direct policy assignments."));
                    _b = 0, _c = rolePoliciesMap.entries();
                    _f.label = 7;
                case 7:
                    if (!(_b < _c.length)) return [3 /*break*/, 16];
                    _d = _c[_b], role = _d[0], targets = _d[1];
                    bundleName = "".concat(role, " Bundle");
                    bundleDesc = "Default bundle migrated for ".concat(role);
                    return [4 /*yield*/, client.query("INSERT INTO casbin.policy_bundle (name, description, created_at, updated_at)\n         VALUES ($1, $2, NOW(), NOW())\n         ON CONFLICT (name) DO UPDATE SET updated_at = NOW()\n         RETURNING id;", [bundleName, bundleDesc])];
                case 8:
                    bundleRes = _f.sent();
                    bundleId = bundleRes.rows[0].id;
                    _e = 0, targets_1 = targets;
                    _f.label = 9;
                case 9:
                    if (!(_e < targets_1.length)) return [3 /*break*/, 13];
                    target = targets_1[_e];
                    ptype = 'p';
                    if (p2Set.has(target)) {
                        ptype = 'p2';
                    }
                    else if (p3Set.has(target)) {
                        ptype = 'p3';
                    }
                    // Add to policy_bundle_policy
                    return [4 /*yield*/, client.query("INSERT INTO casbin.policy_bundle_policy (bundle_id, policy_name, ptype, created_at)\n           VALUES ($1, $2, $3, NOW())\n           ON CONFLICT ON CONSTRAINT uq_bundle_policy_ptype DO NOTHING;", [bundleId, target, ptype])];
                case 10:
                    // Add to policy_bundle_policy
                    _f.sent();
                    // Add to casbin.casbin_rule as (g, bundleName, target)
                    return [4 /*yield*/, client.query("INSERT INTO casbin.casbin_rule (ptype, v0, v1)\n           VALUES ('g', $1, $2)\n           ON CONFLICT DO NOTHING;", [bundleName, target])];
                case 11:
                    // Add to casbin.casbin_rule as (g, bundleName, target)
                    _f.sent();
                    _f.label = 12;
                case 12:
                    _e++;
                    return [3 /*break*/, 9];
                case 13: 
                // 4. Assign bundle to role via g3: (g3, role, bundleName)
                return [4 /*yield*/, client.query("INSERT INTO casbin.casbin_rule (ptype, v0, v1)\n         VALUES ('g3', $1, $2)\n         ON CONFLICT DO NOTHING;", [role, bundleName])];
                case 14:
                    // 4. Assign bundle to role via g3: (g3, role, bundleName)
                    _f.sent();
                    console.log("Created bundle \"".concat(bundleName, "\" (id: ").concat(bundleId, ") with ").concat(targets.size, " policies and linked to role \"").concat(role, "\" via g3."));
                    _f.label = 15;
                case 15:
                    _b++;
                    return [3 /*break*/, 7];
                case 16:
                    roleNames = Array.from(rolePoliciesMap.keys());
                    if (!(roleNames.length > 0)) return [3 /*break*/, 18];
                    return [4 /*yield*/, client.query("DELETE FROM casbin.casbin_rule WHERE ptype = 'g' AND v0 = ANY($1::text[]);", [roleNames])];
                case 17:
                    deleteResult = _f.sent();
                    console.log("Deleted ".concat(deleteResult.rowCount, " obsolete direct role-policy 'g' rules."));
                    _f.label = 18;
                case 18: return [4 /*yield*/, client.query("SELECT ptype, count(*) FROM casbin.casbin_rule GROUP BY ptype ORDER BY ptype;")];
                case 19:
                    ruleCounts = _f.sent();
                    console.log('Casbin rule counts after migration:', ruleCounts.rows);
                    return [4 /*yield*/, client.query("SELECT count(*) FROM casbin.policy_bundle;")];
                case 20:
                    bundleCount = _f.sent();
                    console.log("Total Policy Bundles in database: ".concat(bundleCount.rows[0].count));
                    return [4 /*yield*/, client.query("SELECT count(*) FROM casbin.policy_bundle_policy;")];
                case 21:
                    bundlePolicyCount = _f.sent();
                    console.log("Total Bundle Policies in database: ".concat(bundlePolicyCount.rows[0].count));
                    console.log('Migration to Policy Bundle architecture completed successfully!');
                    return [3 /*break*/, 24];
                case 22: return [4 /*yield*/, client.end()];
                case 23:
                    _f.sent();
                    return [7 /*endfinally*/];
                case 24: return [2 /*return*/];
            }
        });
    });
}
if (require.main === module) {
    migrateToPolicyBundles().catch(function (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    });
}
