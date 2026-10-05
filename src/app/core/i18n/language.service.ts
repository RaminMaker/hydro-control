import { DOCUMENT } from "@angular/common";
import { Injectable, computed, inject, signal } from "@angular/core";

export type AppLanguage = "en" | "fa";

const EN: Record<string, string> = {
  "brand.name": "Hydro Control",
  "navigation.failed": "This section did not load correctly.",
  "navigation.retry": "Reload application",
  "brand.subtitle": "INDUSTRIAL IOT",
  "nav.overview": "Overview",
  "nav.analytics": "Analytics",
  "nav.heating": "Heating",
  "nav.alarms": "Alarms",
  "nav.system": "System",
  "navigation.mobile": "Main navigation",
  "sidebar.open": "Open navigation",
  "sidebar.close": "Close navigation",
  "sidebar.expand": "Expand sidebar",
  "sidebar.collapse": "Collapse sidebar",
  "gateway.title": "EDGE GATEWAY",
  "gateway.node": "HOUSE-01",
  "profile.role": "Control Engineer",
  "profile.adminName": "Administrator",
  "profile.level": "Operator Level 2",
  "header.eyebrow": "SMART WATER & HEATING INFRASTRUCTURE",
  "header.title": "Residential Water & Heating Plant",
  "header.live": "LIVE TELEMETRY",
  "header.language": "Language",
  "header.theme": "Theme",
  "header.burnerBanner": "Boiler burner is on",
  "header.burnerBannerText":
    "The boiler package has ignited and the heating loop is actively warming the radiators.",
  "theme.dark": "Dark",
  "theme.light": "Light",
  "lang.en": "English",
  "lang.fa": "فارسی",
  "connection.connecting": "connecting",
  "connection.online": "online",
  "connection.offline": "offline",
  "connection.error": "error",

  "login.eyebrow": "SECURE OPERATIONS ACCESS",
  "login.heroTitle":
    "Industrial monitoring, control and digital twin workspace.",
  "login.heroText":
    "A secure operator entry point for the residential water and heating control center, with real-time WebSocket telemetry and interactive equipment views.",
  "login.access": "OPERATOR ACCESS",
  "login.title": "Sign in to Control Center",
  "login.subtitle":
    "Authenticate to access live telemetry, controls and system diagnostics.",
  "login.username": "Username",
  "login.password": "Password",
  "login.usernamePlaceholder": "Enter username",
  "login.passwordPlaceholder": "Enter password",
  "login.signIn": "SIGN IN",
  "login.signingIn": "AUTHENTICATING…",
  "login.invalid": "Username or password is incorrect.",
  "login.serverUnavailable":
    "Authentication service is unavailable. Start the mock server and try again.",
  "login.serverError": "Authentication failed. Please try again.",
  "profile.logout": "Logout",
  "loading.route": "Loading control module",

  "dashboard.flowRate": "FLOW RATE",
  "dashboard.live": "LIVE",
  "dashboard.motorSpeed": "MOTOR SPEED",
  "dashboard.vfdOutput": "VFD OUTPUT",
  "dashboard.powerDraw": "POWER DRAW",
  "dashboard.efficiency": "EFFICIENCY",
  "dashboard.motorTemp": "MOTOR TEMP",
  "dashboard.thermalNominal": "THERMAL NOMINAL",
  "dashboard.asset": "ASSET P-101",
  "dashboard.digitalTwin": "Pump, Boiler & Radiator Digital Twin",
  "dashboard.head": "HEAD",
  "dashboard.valve": "VALVE",
  "dashboard.processValue": "PROCESS VALUE",
  "dashboard.pressureLoop": "Pressure Loop",
  "dashboard.lowLimit": "LOW LIMIT",
  "dashboard.deadband": "DEADBAND",
  "dashboard.highLimit": "HIGH LIMIT",
  "dashboard.realTimeTrend": "REAL-TIME TREND",
  "dashboard.hydraulicTelemetry": "Hydraulic Telemetry",
  "dashboard.supplyStorage": "SUPPLY STORAGE",
  "dashboard.roofTank": "Roof Tank",
  "dashboard.estVolume": "EST. VOLUME",
  "dashboard.reserve": "RESERVE",
  "dashboard.levelState": "LEVEL STATE",
  "dashboard.normal": "NORMAL",
  "dashboard.eventJournal": "EVENT JOURNAL",
  "dashboard.systemEvents": "System Events",
  "dashboard.active": "ACTIVE",
  "dashboard.noFaults": "No active faults",
  "dashboard.noFaultsText":
    "All monitored parameters are within operating limits.",
  "dashboard.lastAck": "LAST COMMAND ACK",
  "dashboard.boilerSupply": "BOILER SUPPLY",
  "dashboard.boilerReturn": "BOILER RETURN",
  "dashboard.burner": "BURNER",
  "dashboard.heatExchanger": "HEAT EXCHANGER",

  "control.remote": "REMOTE CONTROL",
  "control.title": "Pump Controller",
  "control.running": "RUNNING",
  "control.stopped": "STOPPED",
  "control.auto": "AUTO",
  "control.manual": "MANUAL",
  "control.off": "OFF",
  "control.pressureSetpoint": "Pressure setpoint",
  "control.outletValve": "Outlet valve",
  "control.boilerPackage": "Boiler package",
  "control.boilerSwitch": "Boiler enable",
  "control.radiatorLoopValve": "Radiator loop valve",
  "control.zoneValves": "Individual radiator valves",
  "control.faultSimulation": "Fault simulation",
  "control.normalOperation": "Normal operation",
  "control.boilerFailure": "Boiler failure",
  "control.lowPressure": "Low pressure",
  "control.airlock": "Airlock",
  "control.open": "OPEN",
  "control.close": "CLOSE",
  "control.start": "START PUMP",
  "control.stop": "STOP",

  "gauge.dischargePressure": "DISCHARGE PRESSURE",
  "gauge.setpoint": "SETPOINT",
  "trend.range": "Time range",
  "trend.live": "Live",
  "trend.hour": "1 hour",
  "trend.day": "24 hours",
  "trend.week": "7 days",
  "trend.month": "30 days",
  "trend.zoomIn": "Zoom in",
  "trend.zoomOut": "Zoom out",
  "trend.resetZoom": "Reset zoom",
  "trend.interactive": "Interactive",
  "trend.interactionHint":
    "Hover for values · wheel or drag to zoom · Shift+drag to pan",
  "trend.simulatedNotice": "Demo history is simulated",
  "trend.historyUnavailable":
    "History not available; check the gateway connection",
  "chart.pressure": "Pressure",
  "chart.flow": "Flow",

  "scene.badge": "DIGITAL TWIN · PUMP / BOILER / RADIATOR LOOP",
  "scene.hint": "DRAG TO ORBIT · SCROLL TO ZOOM",
  "scene.focus": "VIEW INTERIOR",
  "scene.reset": "RESET VIEW",
  "scene.explode": "EXPLODED VIEW",
  "scene.labels": "PART LABELS",
  "scene.locked": "Locked",
  "scene.unlocked": "Unlocked",
  "scene.lock": "Lock scene",
  "scene.unlock": "Unlock scene",
  "scene.unlockHint": "Unlock to rotate, pan, zoom or edit parts",
  "scene.interactionHint":
    "Drag to rotate · right-drag to pan · wheel/pinch to zoom · click labels",
  "scene.clickToEdit": "Open part settings",
  "scene.partSettings": "Part settings",
  "scene.partVisible": "Visible",
  "scene.opacity": "Opacity",
  "scene.materialColor": "Material color",
  "scene.roughness": "Roughness",
  "scene.focusPart": "Focus",
  "scene.resetPart": "Reset",
  "scene.visualOnly":
    "Appearance settings are visual only; they do not modify pump control signals.",
  "scene.importModel": "Import",
  "scene.exportModel": "Export",
  "scene.exportTarget": "Export contents",
  "scene.wholePlant": "Full equipment model",
  "scene.selectedPart": "Selected part",
  "scene.importSuccess": "Model imported",
  "scene.importFailed": "Import failed",
  "scene.exportSuccess": "File created",
  "scene.exportFailed": "Export failed",
  "scene.selectFirst": "Select a label to export a part.",
  "scene.nothingToExport": "Nothing available to export.",
  "scene.showBeforeExport": "Show the selected part before exporting.",
  "scene.removeImported": "Remove imported model",
  "scene.importRemoved": "Imported model removed",
  "scene.importedModel": "Imported model",
  "scene.dismiss": "Close",
  "scene.internal": "INTERNAL IMPELLER / SHAFT / VOLUTE",
  "scene.zoomHint": "Zoom closer to reveal the pump internals",
  "scene.boiler": "BOILER PACKAGE",
  "scene.radiators": "FIVE-RADIATOR HEATING LOOP",

  "heating.eyebrow": "HYDRONIC HEATING LOOP",
  "heating.title": "Boiler Package & Radiator Circuit",
  "heating.subtitle":
    "The pump outlet feeds the boiler package, then hot water circulates through five radiators and returns to the boiler.",
  "heating.burner": "Burner",
  "heating.on": "ON",
  "heating.off": "STANDBY",
  "heating.coldInlet": "Cold water inlet",
  "heating.hotOutlet": "Hot water outlet",
  "heating.supply": "Radiator supply",
  "heating.return": "Radiator return",
  "heating.exchanger": "Heat exchanger body",
  "heating.avgTemp": "Average radiator temperature",
  "heating.radiators": "Radiators",
  "heating.radiator": "Radiator",
  "heating.zoneLabel": "Zone",
  "heating.flowing": "Flowing",
  "heating.cooling": "Cooling",
  "heating.reignitionOn":
    "The burner is active because the radiator loop cooled below the restart threshold.",
  "heating.reignitionOff":
    "The burner is in standby; the radiator circuit is still warm enough.",
  "heating.threshold": "Restart threshold",
  "heating.returningHeat": "Returning heat",
  "heating.pathTitle": "Hydronic circulation map",
  "heating.pumpNode": "Pressure pump",
  "heating.boilerNode": "Boiler package",
  "heating.loopStatus": "Loop valve status",
  "heating.flowLegendHot": "Hot supply",
  "heating.flowLegendCold": "Cold return",
  "heating.flowLegendOff": "Valve closed",
  "heating.burnerAlarm": "Burner event monitor",
  "heating.roomDistribution": "Room heat distribution",
  "heating.roomDistributionText":
    "Live room temperatures based on radiator output and valve position.",
  "heating.livingRoom": "Living room",
  "heating.bedroom": "Bedroom",
  "heating.office": "Office",
  "heating.kitchen": "Kitchen",
  "heating.guestRoom": "Guest room",
  "heating.roomTemp": "Room temperature",
  "heating.zoneValve": "Zone valve",
  "heating.heatOutput": "Heat output",
  "heating.faultStatus": "Fault status",
  "heating.normal": "Normal",
  "heating.faultBoiler": "Boiler lockout",
  "heating.faultPressure": "Low system pressure",
  "heating.faultAirlock": "Radiator 3 airlock",

  "analytics.eyebrow": "PROCESS INTELLIGENCE",
  "analytics.title": "Performance Analytics",
  "analytics.subtitle":
    "Live hydraulic and electrical performance snapshot from the simulated edge gateway.",
  "analytics.trend": "TREND",
  "analytics.heatingTrend": "Heating Loop Trend",
  "analytics.correlation": "Pressure / Flow Correlation",
  "analytics.specificEnergy": "SPECIFIC ENERGY",
  "analytics.specificEnergyText":
    "Energy used to move one cubic metre of water.",
  "analytics.hydraulicLoad": "HYDRAULIC LOAD",
  "analytics.hydraulicLoadText":
    "Estimated operating point relative to nominal design.",
  "analytics.dailyRuntime": "DAILY RUNTIME",
  "analytics.dailyRuntimeText":
    "Rolling 24-hour runtime from the demo historian.",

  "alarms.eyebrow": "EVENT MANAGEMENT",
  "alarms.title": "Alarm Journal",
  "alarms.subtitle":
    "Warnings and trip conditions generated by the WebSocket simulator.",
  "alarms.unack": "UNACKNOWLEDGED",
  "alarms.severity": "SEVERITY",
  "alarms.event": "EVENT",
  "alarms.time": "TIME",
  "alarms.state": "STATE",
  "alarms.healthy": "System healthy",
  "alarms.empty": "No alarm frames have been received in this session.",
  "alarms.acked": "ACKED",
  "alarms.active": "ACTIVE",
  "alarms.info": "info",
  "alarms.warning": "warning",
  "alarms.critical": "critical",

  "settings.eyebrow": "EDGE CONFIGURATION",
  "settings.title": "System Configuration",
  "settings.subtitle":
    "Interview-demo configuration surface. Values are intentionally local-only.",
  "settings.connection": "CONNECTION",
  "settings.gateway": "Telemetry Gateway",
  "settings.wsEndpoint": "WebSocket endpoint",
  "settings.reconnect": "Reconnect policy",
  "settings.reconnectValue": "Exponential backoff · max 8s",
  "settings.asset": "ASSET",
  "settings.pump": "Pump P-101",
  "settings.ratedFlow": "Rated flow",
  "settings.ratedSpeed": "Rated speed",
  "settings.architecture": "ARCHITECTURE",
  "settings.runtime": "Frontend Runtime",

  "alarm.title.pressureDeviation": "Pressure deviation",
  "alarm.msg.pressureDeviation":
    "Discharge pressure moved outside the preferred deadband.",
  "alarm.title.autoRegulation": "Auto regulation",
  "alarm.msg.autoRegulation":
    "VFD speed was adjusted to maintain the requested pressure.",
  "alarm.title.tankAdvisory": "Tank level advisory",
  "alarm.msg.tankAdvisory":
    "Supply tank trend requires operator attention if demand remains high.",
  "alarm.title.boilerIgnition": "Boiler ignition",
  "alarm.msg.boilerIgnition":
    "Radiators cooled down and the boiler burner restarted the heating loop.",
  "alarm.title.boilerStandby": "Boiler standby",
  "alarm.msg.boilerStandby":
    "Radiator loop reached temperature and the boiler burner returned to standby.",
  "alarm.title.boilerEnabled": "Boiler package enabled",
  "alarm.msg.boilerEnabled":
    "The domestic boiler package was enabled by the operator.",
  "alarm.title.boilerDisabled": "Boiler package disabled",
  "alarm.msg.boilerDisabled":
    "The domestic boiler package was turned off by the operator.",
  "alarm.title.radiatorValveClosed": "Radiator valve closed",
  "alarm.msg.radiatorValveClosed":
    "The radiator loop valve is fully closed and heating circulation is interrupted.",
  "alarm.title.faultCleared": "Fault simulation cleared",
  "alarm.msg.faultCleared":
    "Heating system fault simulation returned to normal operation.",
  "alarm.title.boilerFailureSim": "Boiler failure simulated",
  "alarm.msg.boilerFailureSim":
    "The boiler burner has been locked out and heat generation is unavailable.",
  "alarm.title.lowPressureSim": "Low pressure simulated",
  "alarm.msg.lowPressureSim":
    "Hydronic pressure has dropped and circulation performance is degraded.",
  "alarm.title.airlockSim": "Radiator airlock simulated",
  "alarm.msg.airlockSim":
    "Radiator 3 is partially airlocked and heat transfer is reduced.",
  "ack.start": "Pump start command accepted",
  "ack.stop": "Pump stop command accepted",
  "ack.alarm": "Alarm acknowledged",
};

const FA: Record<string, string> = {
  "brand.name": "Hydro Control",
  "navigation.failed": "بارگذاری این صفحه با خطا مواجه شد.",
  "navigation.retry": "بارگذاری مجدد برنامه",
  "brand.subtitle": "اینترنت اشیای صنعتی",
  "nav.overview": "نمای کلی",
  "nav.analytics": "تحلیل عملکرد",
  "nav.heating": "گرمایش",
  "nav.alarms": "هشدارها",
  "nav.system": "تنظیمات سیستم",
  "navigation.mobile": "منوی اصلی",
  "sidebar.open": "باز کردن منو",
  "sidebar.close": "بستن منو",
  "sidebar.expand": "باز کردن سایدبار",
  "sidebar.collapse": "جمع کردن سایدبار",
  "gateway.title": "درگاه لبه",
  "gateway.node": "خانه ۰۱",
  "profile.role": "مهندس کنترل",
  "profile.adminName": "مدیر سیستم",
  "profile.level": "اپراتور سطح ۲",
  "header.eyebrow": "زیرساخت هوشمند آب و گرمایش",
  "header.title": "سامانه آب و گرمایش خانگی",
  "header.live": "تله‌متری زنده",
  "header.language": "زبان",
  "header.theme": "پوسته",
  "header.burnerBanner": "مشعل پکیج روشن شد",
  "header.burnerBannerText":
    "مشعل پکیج فعال شده و مدار گرمایش در حال گرم کردن سوفاژها است.",
  "theme.dark": "تیره",
  "theme.light": "روشن",
  "lang.en": "English",
  "lang.fa": "فارسی",
  "connection.connecting": "در حال اتصال",
  "connection.online": "آنلاین",
  "connection.offline": "آفلاین",
  "connection.error": "خطا",

  "login.eyebrow": "ورود امن به سامانه عملیاتی",
  "login.heroTitle": "مرکز صنعتی پایش، کنترل و دوقلوی دیجیتال تجهیزات.",
  "login.heroText":
    "درگاه امن اپراتور برای سامانه آب و گرمایش خانه با تله‌متری لحظه‌ای WebSocket و نمایش تعاملی تجهیزات.",
  "login.access": "دسترسی اپراتور",
  "login.title": "ورود به مرکز کنترل",
  "login.subtitle":
    "برای دسترسی به داده‌های زنده، کنترل تجهیزات و عیب‌یابی سیستم وارد شوید.",
  "login.username": "نام کاربری",
  "login.password": "رمز عبور",
  "login.usernamePlaceholder": "نام کاربری را وارد کنید",
  "login.passwordPlaceholder": "رمز عبور را وارد کنید",
  "login.signIn": "ورود به سامانه",
  "login.signingIn": "در حال احراز هویت…",
  "login.invalid": "نام کاربری یا رمز عبور صحیح نیست.",
  "login.serverUnavailable":
    "سرویس ورود در دسترس نیست. سرور آزمایشی را اجرا و دوباره تلاش کنید.",
  "login.serverError": "ورود انجام نشد. دوباره تلاش کنید.",
  "profile.logout": "خروج",
  "loading.route": "در حال بارگذاری ماژول کنترل",

  "dashboard.flowRate": "دبی لحظه‌ای",
  "dashboard.live": "زنده",
  "dashboard.motorSpeed": "سرعت موتور",
  "dashboard.vfdOutput": "خروجی اینورتر",
  "dashboard.powerDraw": "توان مصرفی",
  "dashboard.efficiency": "بازده",
  "dashboard.motorTemp": "دمای موتور",
  "dashboard.thermalNominal": "دمای نرمال",
  "dashboard.asset": "تجهیز P-101",
  "dashboard.digitalTwin": "دوقلوی دیجیتال پمپ، پکیج و سوفاژها",
  "dashboard.head": "هد",
  "dashboard.valve": "شیر",
  "dashboard.processValue": "مقدار فرآیندی",
  "dashboard.pressureLoop": "حلقه کنترل فشار",
  "dashboard.lowLimit": "حد پایین",
  "dashboard.deadband": "محدوده بی‌حسی",
  "dashboard.highLimit": "حد بالا",
  "dashboard.realTimeTrend": "روند لحظه‌ای",
  "dashboard.hydraulicTelemetry": "تله‌متری هیدرولیک",
  "dashboard.supplyStorage": "ذخیره آب",
  "dashboard.roofTank": "مخزن بام",
  "dashboard.estVolume": "حجم تقریبی",
  "dashboard.reserve": "ذخیره",
  "dashboard.levelState": "وضعیت سطح",
  "dashboard.normal": "نرمال",
  "dashboard.eventJournal": "گزارش رویداد",
  "dashboard.systemEvents": "رویدادهای سیستم",
  "dashboard.active": "فعال",
  "dashboard.noFaults": "خطای فعالی وجود ندارد",
  "dashboard.noFaultsText":
    "تمام پارامترهای مانیتور شده در محدوده مجاز عملکرد قرار دارند.",
  "dashboard.lastAck": "آخرین تایید فرمان",
  "dashboard.boilerSupply": "رفت پکیج",
  "dashboard.boilerReturn": "برگشت پکیج",
  "dashboard.burner": "مشعل",
  "dashboard.heatExchanger": "مبدل حرارتی",

  "control.remote": "کنترل از راه دور",
  "control.title": "کنترلر پمپ",
  "control.running": "در حال کار",
  "control.stopped": "متوقف",
  "control.auto": "خودکار",
  "control.manual": "دستی",
  "control.off": "خاموش",
  "control.pressureSetpoint": "فشار هدف",
  "control.outletValve": "شیر خروجی",
  "control.boilerPackage": "پکیج گرمایشی",
  "control.boilerSwitch": "روشن/خاموش پکیج",
  "control.radiatorLoopValve": "فلکه مدار سوفاژ",
  "control.zoneValves": "فلکه مستقل سوفاژها",
  "control.faultSimulation": "شبیه‌سازی خرابی",
  "control.normalOperation": "حالت عادی",
  "control.boilerFailure": "خرابی پکیج",
  "control.lowPressure": "افت فشار",
  "control.airlock": "هواگرفتگی",
  "control.open": "باز",
  "control.close": "بسته",
  "control.start": "راه‌اندازی پمپ",
  "control.stop": "توقف",

  "gauge.dischargePressure": "فشار خروجی پمپ",
  "gauge.setpoint": "فشار هدف",
  "trend.range": "بازه زمانی",
  "trend.live": "زنده",
  "trend.hour": "۱ ساعت",
  "trend.day": "۲۴ ساعت",
  "trend.week": "۷ روز",
  "trend.month": "۳۰ روز",
  "trend.zoomIn": "بزرگ‌نمایی",
  "trend.zoomOut": "کوچک‌نمایی",
  "trend.resetZoom": "بازنشانی زوم",
  "trend.interactive": "تعاملی",
  "trend.interactionHint":
    "نمایش مقدار با ماوس · زوم با اسکرول یا کشیدن · جابه‌جایی با Shift",
  "trend.simulatedNotice": "تاریخچه آزمایشی و شبیه‌سازی‌شده است",
  "trend.historyUnavailable":
    "تاریخچه در دسترس نیست؛ اتصال به سرور را بررسی کنید",
  "chart.pressure": "فشار",
  "chart.flow": "دبی",

  "scene.badge": "دوقلوی دیجیتال · پمپ / پکیج / مدار سوفاژ",
  "scene.hint": "برای چرخش بکشید · برای زوم اسکرول کنید",
  "scene.focus": "نمای داخل پمپ",
  "scene.reset": "بازنشانی نما",
  "scene.explode": "نمای انفجاری",
  "scene.labels": "برچسب قطعات",
  "scene.locked": "قفل است",
  "scene.unlocked": "قفل باز",
  "scene.lock": "قفل کردن صحنه",
  "scene.unlock": "باز کردن قفل",
  "scene.unlockHint":
    "برای چرخش، جابه‌جایی، زوم و تنظیم قطعات، قفل را باز کنید",
  "scene.interactionHint":
    "درگ: چرخش · راست‌کلیک: جابه‌جایی · اسکرول: زوم · کلیک برچسب: تنظیمات",
  "scene.clickToEdit": "باز کردن تنظیمات قطعه",
  "scene.partSettings": "تنظیمات قطعه",
  "scene.partVisible": "نمایش قطعه",
  "scene.opacity": "میزان شفافیت",
  "scene.materialColor": "رنگ متریال",
  "scene.roughness": "زبری سطح",
  "scene.focusPart": "نمای نزدیک",
  "scene.resetPart": "بازنشانی",
  "scene.visualOnly":
    "این تنظیمات فقط ظاهر مدل را تغییر می‌دهند و فرمانی به پمپ واقعی ارسال نمی‌کنند.",
  "scene.importModel": "ایمپورت",
  "scene.exportModel": "اکسپورت",
  "scene.exportTarget": "محتوای خروجی",
  "scene.wholePlant": "مدل کامل تجهیزات",
  "scene.selectedPart": "قطعه انتخابی",
  "scene.importSuccess": "مدل وارد شد",
  "scene.importFailed": "ورود مدل ناموفق بود",
  "scene.exportSuccess": "فایل ساخته شد",
  "scene.exportFailed": "ساخت خروجی ناموفق بود",
  "scene.selectFirst": "ابتدا روی برچسب یک قطعه کلیک کنید.",
  "scene.nothingToExport": "مدلی برای خروجی موجود نیست.",
  "scene.showBeforeExport": "برای خروجی ابتدا نمایش قطعه را فعال کنید.",
  "scene.removeImported": "حذف مدل واردشده",
  "scene.importRemoved": "مدل واردشده حذف شد",
  "scene.importedModel": "مدل واردشده",
  "scene.dismiss": "بستن",
  "scene.internal": "ایمپلر داخلی / شفت / پوسته حلزونی",
  "scene.zoomHint": "برای مشاهده اجزای داخلی، روی پمپ زوم کنید",
  "scene.boiler": "پکیج گرمایشی",
  "scene.radiators": "مدار گرمایش ۵ سوفاژ",

  "heating.eyebrow": "مدار گرمایش آب‌گرد",
  "heating.title": "پکیج و مدار گردش سوفاژها",
  "heating.subtitle":
    "خروجی پمپ به پکیج متصل است و سپس آب گرم در بین پنج سوفاژ جریان پیدا می‌کند و دوباره به پکیج برمی‌گردد.",
  "heating.burner": "مشعل",
  "heating.on": "روشن",
  "heating.off": "آماده‌به‌کار",
  "heating.coldInlet": "ورودی آب سرد",
  "heating.hotOutlet": "خروجی آب گرم",
  "heating.supply": "رفت مدار سوفاژ",
  "heating.return": "برگشت مدار",
  "heating.exchanger": "دمای کامل مبدل",
  "heating.avgTemp": "میانگین دمای سوفاژها",
  "heating.radiators": "سوفاژها",
  "heating.radiator": "سوفاژ",
  "heating.zoneLabel": "زون",
  "heating.flowing": "در حال گردش",
  "heating.cooling": "در حال خنک شدن",
  "heating.reignitionOn":
    "به علت خنک شدن سوفاژها، مشعل دوباره وارد مدار گرمایش شده است.",
  "heating.reignitionOff":
    "دمای مدار هنوز مناسب است و مشعل در حالت آماده‌به‌کار قرار دارد.",
  "heating.threshold": "آستانه روشن‌شدن",
  "heating.returningHeat": "حرارت برگشتی",
  "heating.pathTitle": "نقشه گردش آب مدار",
  "heating.pumpNode": "پمپ فشار",
  "heating.boilerNode": "پکیج گرمایشی",
  "heating.loopStatus": "وضعیت فلکه مدار",
  "heating.flowLegendHot": "رفت آب گرم",
  "heating.flowLegendCold": "برگشت آب سرد",
  "heating.flowLegendOff": "فلکه بسته",
  "heating.burnerAlarm": "مانیتور رخداد مشعل",
  "heating.roomDistribution": "توزیع گرما بین اتاق‌ها",
  "heating.roomDistributionText":
    "دمای زنده اتاق‌ها بر اساس گرمای سوفاژ و میزان باز بودن فلکه.",
  "heating.livingRoom": "پذیرایی",
  "heating.bedroom": "اتاق خواب",
  "heating.office": "اتاق کار",
  "heating.kitchen": "آشپزخانه",
  "heating.guestRoom": "اتاق مهمان",
  "heating.roomTemp": "دمای اتاق",
  "heating.zoneValve": "فلکه مستقل",
  "heating.heatOutput": "توان گرمایی",
  "heating.faultStatus": "وضعیت خرابی",
  "heating.normal": "عادی",
  "heating.faultBoiler": "قفل خرابی پکیج",
  "heating.faultPressure": "افت فشار مدار",
  "heating.faultAirlock": "هواگرفتگی سوفاژ ۳",

  "analytics.eyebrow": "هوشمندی فرآیند",
  "analytics.title": "تحلیل عملکرد",
  "analytics.subtitle":
    "نمای زنده عملکرد هیدرولیکی و الکتریکی از شبیه‌ساز درگاه Edge.",
  "analytics.trend": "روند",
  "analytics.heatingTrend": "روند مدار گرمایش",
  "analytics.correlation": "همبستگی فشار و دبی",
  "analytics.specificEnergy": "انرژی ویژه",
  "analytics.specificEnergyText": "انرژی مصرفی برای جابه‌جایی یک متر مکعب آب.",
  "analytics.hydraulicLoad": "بار هیدرولیکی",
  "analytics.hydraulicLoadText": "تخمین نقطه عملکرد نسبت به شرایط طراحی نامی.",
  "analytics.dailyRuntime": "کارکرد روزانه",
  "analytics.dailyRuntimeText": "مدت کارکرد ۲۴ ساعت اخیر از تاریخچه آزمایشی.",

  "alarms.eyebrow": "مدیریت رویدادها",
  "alarms.title": "دفترچه هشدارها",
  "alarms.subtitle": "هشدارها و شرایط حفاظتی تولیدشده توسط شبیه‌ساز WebSocket.",
  "alarms.unack": "تایید نشده",
  "alarms.severity": "شدت",
  "alarms.event": "رویداد",
  "alarms.time": "زمان",
  "alarms.state": "وضعیت",
  "alarms.healthy": "سیستم سالم است",
  "alarms.empty": "در این نشست هیچ فریم هشداری دریافت نشده است.",
  "alarms.acked": "تایید شده",
  "alarms.active": "فعال",
  "alarms.info": "اطلاع",
  "alarms.warning": "هشدار",
  "alarms.critical": "بحرانی",

  "settings.eyebrow": "پیکربندی Edge",
  "settings.title": "پیکربندی سیستم",
  "settings.subtitle":
    "صفحه تنظیمات نسخه دمو برای مصاحبه؛ مقادیر عمداً فقط محلی هستند.",
  "settings.connection": "اتصال",
  "settings.gateway": "درگاه تله‌متری",
  "settings.wsEndpoint": "آدرس WebSocket",
  "settings.reconnect": "سیاست اتصال مجدد",
  "settings.reconnectValue": "وقفه تصاعدی · حداکثر ۸ ثانیه",
  "settings.asset": "تجهیز",
  "settings.pump": "پمپ P-101",
  "settings.ratedFlow": "دبی نامی",
  "settings.ratedSpeed": "سرعت نامی",
  "settings.architecture": "معماری",
  "settings.runtime": "محیط اجرای فرانت‌اند",

  "alarm.title.pressureDeviation": "انحراف فشار",
  "alarm.msg.pressureDeviation":
    "فشار خروجی از محدوده ترجیحی کنترل خارج شده است.",
  "alarm.title.autoRegulation": "تنظیم خودکار",
  "alarm.msg.autoRegulation": "سرعت اینورتر برای حفظ فشار درخواستی اصلاح شد.",
  "alarm.title.tankAdvisory": "هشدار سطح مخزن",
  "alarm.msg.tankAdvisory":
    "در صورت ادامه مصرف بالا، روند سطح مخزن به توجه اپراتور نیاز دارد.",
  "alarm.title.boilerIgnition": "روشن‌شدن مشعل پکیج",
  "alarm.msg.boilerIgnition":
    "سوفاژها خنک شدند و مشعل پکیج دوباره مدار گرمایش را فعال کرد.",
  "alarm.title.boilerStandby": "آماده‌به‌کار شدن پکیج",
  "alarm.msg.boilerStandby":
    "دمای مدار سوفاژ به حد مطلوب رسید و مشعل پکیج به حالت آماده‌به‌کار برگشت.",
  "alarm.title.boilerEnabled": "پکیج فعال شد",
  "alarm.msg.boilerEnabled": "پکیج گرمایشی توسط اپراتور فعال شد.",
  "alarm.title.boilerDisabled": "پکیج غیرفعال شد",
  "alarm.msg.boilerDisabled": "پکیج گرمایشی توسط اپراتور خاموش شد.",
  "alarm.title.radiatorValveClosed": "فلکه سوفاژ بسته شد",
  "alarm.msg.radiatorValveClosed":
    "فلکه مدار سوفاژ کاملاً بسته شده و گردش آب گرمایش متوقف است.",
  "alarm.title.faultCleared": "شبیه‌سازی خرابی پایان یافت",
  "alarm.msg.faultCleared": "سامانه گرمایش به وضعیت عادی بازگشت.",
  "alarm.title.boilerFailureSim": "خرابی پکیج شبیه‌سازی شد",
  "alarm.msg.boilerFailureSim": "مشعل پکیج قفل شده و تولید گرما در دسترس نیست.",
  "alarm.title.lowPressureSim": "افت فشار شبیه‌سازی شد",
  "alarm.msg.lowPressureSim":
    "فشار مدار گرمایش کاهش یافته و گردش آب ضعیف شده است.",
  "alarm.title.airlockSim": "هواگرفتگی شبیه‌سازی شد",
  "alarm.msg.airlockSim":
    "سوفاژ شماره ۳ هواگرفته و انتقال گرمای آن کاهش یافته است.",
  "ack.start": "فرمان راه‌اندازی پمپ پذیرفته شد",
  "ack.stop": "فرمان توقف پمپ پذیرفته شد",
  "ack.alarm": "هشدار تایید شد",
};

const SERVER_KEYS: Record<string, string> = {
  "Pressure deviation": "alarm.title.pressureDeviation",
  "Discharge pressure moved outside the preferred deadband.":
    "alarm.msg.pressureDeviation",
  "Auto regulation": "alarm.title.autoRegulation",
  "VFD speed was adjusted to maintain the requested pressure.":
    "alarm.msg.autoRegulation",
  "Tank level advisory": "alarm.title.tankAdvisory",
  "Supply tank trend requires operator attention if demand remains high.":
    "alarm.msg.tankAdvisory",
  "Boiler ignition": "alarm.title.boilerIgnition",
  "Radiators cooled down and the boiler burner restarted the heating loop.":
    "alarm.msg.boilerIgnition",
  "Boiler standby": "alarm.title.boilerStandby",
  "Radiator loop reached temperature and the boiler burner returned to standby.":
    "alarm.msg.boilerStandby",
  "Boiler package enabled": "alarm.title.boilerEnabled",
  "The domestic boiler package was enabled by the operator.":
    "alarm.msg.boilerEnabled",
  "Boiler package disabled": "alarm.title.boilerDisabled",
  "The domestic boiler package was turned off by the operator.":
    "alarm.msg.boilerDisabled",
  "Radiator valve closed": "alarm.title.radiatorValveClosed",
  "The radiator loop valve is fully closed and heating circulation is interrupted.":
    "alarm.msg.radiatorValveClosed",
  "Fault simulation cleared": "alarm.title.faultCleared",
  "Heating system fault simulation returned to normal operation.":
    "alarm.msg.faultCleared",
  "Boiler failure simulated": "alarm.title.boilerFailureSim",
  "The boiler burner has been locked out and heat generation is unavailable.":
    "alarm.msg.boilerFailureSim",
  "Low pressure simulated": "alarm.title.lowPressureSim",
  "Hydronic pressure has dropped and circulation performance is degraded.":
    "alarm.msg.lowPressureSim",
  "Radiator airlock simulated": "alarm.title.airlockSim",
  "Radiator 3 is partially airlocked and heat transfer is reduced.":
    "alarm.msg.airlockSim",
  "Pump start command accepted": "ack.start",
  "Pump stop command accepted": "ack.stop",
  "Alarm acknowledged": "ack.alarm",
};

@Injectable({ providedIn: "root" })
export class LanguageService {
  private readonly document = inject(DOCUMENT);
  private readonly _language = signal<AppLanguage>(this.readInitialLanguage());

  readonly language = this._language.asReadonly();
  readonly isRtl = computed(() => this._language() === "fa");
  readonly direction = computed<"rtl" | "ltr">(() =>
    this.isRtl() ? "rtl" : "ltr",
  );

  constructor() {
    this.applyDocumentLanguage(this._language());
  }

  setLanguage(language: AppLanguage): void {
    this._language.set(language);
    localStorage.setItem("hydro.control.language", language);
    this.applyDocumentLanguage(language);
  }

  toggle(): void {
    this.setLanguage(this._language() === "en" ? "fa" : "en");
  }

  t(key: string): string {
    const dict = this._language() === "fa" ? FA : EN;
    return dict[key] ?? EN[key] ?? key;
  }

  server(text: string): string {
    const key = SERVER_KEYS[text];
    if (key) return this.t(key);

    const mode = text.match(/^Mode changed to (AUTO|MANUAL|OFF)$/);
    if (mode)
      return this._language() === "fa"
        ? `حالت پمپ به ${this.mode(mode[1])} تغییر کرد`
        : text;

    const pressure = text.match(/^Pressure setpoint ([\d.]+) bar$/);
    if (pressure)
      return this._language() === "fa"
        ? `فشار هدف روی ${pressure[1]} bar تنظیم شد`
        : text;

    const valve = text.match(/^Outlet valve (\d+)%$/);
    if (valve)
      return this._language() === "fa"
        ? `شیر خروجی روی ${valve[1]}٪ تنظیم شد`
        : text;

    const radValve = text.match(/^Radiator valve (\d+)%$/);
    if (radValve)
      return this._language() === "fa"
        ? `فلکه مدار سوفاژ روی ${radValve[1]}٪ تنظیم شد`
        : text;

    const boilerState = text.match(/^Boiler package (enabled|disabled)$/);
    if (boilerState)
      return this._language() === "fa"
        ? `پکیج گرمایشی ${boilerState[1] === "enabled" ? "فعال" : "غیرفعال"} شد`
        : text;

    const zoneValve = text.match(/^Radiator (\d+) valve (\d+)%$/);
    if (zoneValve)
      return this._language() === "fa"
        ? `فلکه سوفاژ ${zoneValve[1]} روی ${zoneValve[2]}٪ تنظیم شد`
        : text;

    const fault = text.match(
      /^Heating fault mode (NONE|BOILER_FAILURE|LOW_PRESSURE|AIRLOCK)$/,
    );
    if (fault && this._language() === "fa") {
      const map: Record<string, string> = {
        NONE: "عادی",
        BOILER_FAILURE: "خرابی پکیج",
        LOW_PRESSURE: "افت فشار",
        AIRLOCK: "هواگرفتگی",
      };
      return `حالت خرابی روی ${map[fault[1]]} تنظیم شد`;
    }

    return text;
  }

  mode(mode: string): string {
    if (mode === "AUTO") return this.t("control.auto");
    if (mode === "MANUAL") return this.t("control.manual");
    if (mode === "OFF") return this.t("control.off");
    return mode;
  }

  severity(value: string): string {
    return this.t(`alarms.${value}`);
  }

  private readInitialLanguage(): AppLanguage {
    const saved = localStorage.getItem("hydro.control.language");
    return saved === "fa" || saved === "en" ? saved : "fa";
  }

  private applyDocumentLanguage(language: AppLanguage): void {
    const root = this.document.documentElement;
    root.lang = language;
    root.dir = language === "fa" ? "rtl" : "ltr";
    root.dataset["language"] = language;
  }
}
