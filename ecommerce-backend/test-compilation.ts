// Test compilation of all fixed modules
import "./src/modules/auth/jwt.service.js";
import "./src/modules/cache/index.js";
import "./src/modules/cache/cache.monitor.js";
import "./src/modules/notifications/websocket.service.js";
import "./src/core/repositories/notification.repository.js";
import "./src/core/database/schema/notifications.js";

console.log("All modules compiled successfully!");
