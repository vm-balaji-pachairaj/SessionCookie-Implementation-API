import { initializeTelemetry } from "nest-common-utilities";

initializeTelemetry({
  serviceName: process.env.SERVICE_NAME || "session-cookie-api",
  serviceVersion: process.env.SERVICE_VERSION || "1.0.0",
  environment: process.env.NODE_ENV || "development",
});