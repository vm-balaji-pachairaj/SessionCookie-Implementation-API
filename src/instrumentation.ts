import { initializeTelemetry } from "nest-common-utilities";

// Central telemetry bootstrap for the service. The values default to sensible
// local-development settings so the app can start without a full production env.
initializeTelemetry({
  serviceName: process.env.SERVICE_NAME || "session-cookie-api",
  serviceVersion: process.env.SERVICE_VERSION || "1.0.0",
  environment: process.env.NODE_ENV || "development",
});