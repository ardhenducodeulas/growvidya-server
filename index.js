const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const config = require('./config/app.config');
const { testConnection } = require('./config/db.config');

// Middleware & Route Imports
const errorMiddleware = require('./middlewares/error.middleware');
const adminAuthRoutes = require('./routes/adminAuth.routes');
const adminAcademicRoutes = require('./routes/adminAcademic.routes');
const adminTeacherRoutes = require('./routes/adminTeacher.routes');
const adminStudentRoutes = require('./routes/adminStudent.routes');
const adminParentRoutes = require('./routes/adminParent.routes');
const adminStaffRoutes = require('./routes/adminStaff.routes');
const adminAttendanceRoutes = require('./routes/adminAttendance.routes');
const adminLeaveRoutes = require('./routes/adminLeave.routes');
const adminTransportRoutes = require('./routes/adminTransport.routes');
const adminPermissionRoutes = require('./routes/adminPermission.routes');
const adminExaminationRoutes = require('./routes/adminExamination.routes');
const adminFeesRoutes = require('./routes/adminFees.routes');
const adminDashboardRoutes = require('./routes/adminDashboard.routes');
const adminPayrollRoutes = require('./routes/adminPayroll.routes');
const adminHostelRoutes = require('./routes/adminHostel.routes');
const adminAnnouncementRoutes = require('./routes/adminAnnouncement.routes');
const adminCertificateRoutes = require('./routes/adminCertificate.routes');
const adminReportRoutes = require('./routes/adminReport.routes');
const adminMiscSettingRoutes = require('./routes/adminMiscSetting.routes');
const adminIdCardRoutes = require('./routes/adminIdCard.routes');
const teacherAuthRoutes = require('./routes/teacherAuth.routes');
const teacherDashboardRoutes = require('./routes/teacherDashboard.routes');
const teacherAcademicRoutes = require('./routes/teacherAcademic.routes');
const teacherAttendanceRoutes = require('./routes/teacherAttendance.routes');
const teacherAnnouncementRoutes = require('./routes/teacherAnnouncement.routes');
const teacherHostelRoutes = require('./routes/teacherHostel.routes');
const teacherTransportRoutes = require('./routes/teacherTransport.routes');
const teacherLeaveRoutes = require('./routes/teacherLeave.routes');
const teacherPayrollRoutes = require('./routes/teacherPayroll.routes');
const parentAuthRoutes = require('./routes/parentAuth.routes');
const parentDashboardRoutes = require('./routes/parentDashboard.routes');
const parentChildRoutes = require('./routes/parentChild.routes');
const studentAuthRoutes = require('./routes/studentAuth.routes');
const studentPortalRoutes = require('./routes/studentPortal.routes');
const uploadRoutes = require('./routes/upload.routes');
const commonOptionsRoutes = require('./routes/commonOptions.routes');
const saasRoutes = require('./routes/saas.routes');
const adminSubscriptionRoutes = require('./routes/adminSubscription.routes');
const webhookRoutes = require('./routes/webhook.routes');
const subscriptionGuard = require('./middlewares/subscriptionGuard.middleware');
const paramsDecoderMiddleware = require('./middlewares/paramsDecoder.middleware');
const ApiResponse = require('./utils/api.response');

const app = express();

// Security & Parsing Middlewares
app.use(helmet({ crossOriginResourcePolicy: false }));

app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  })
);
app.use(
  express.json({
    limit: '50mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser(config.cookie.secret));
app.use(paramsDecoderMiddleware);

// Serve static assets & uploads
const legacyUploads = 'C:/xampp/htdocs/growvidya/upload';
if (fs.existsSync(legacyUploads)) {
  app.use('/upload', express.static(legacyUploads));
}
app.use('/upload', express.static(path.join(__dirname, 'public/upload')));

const legacyVidyaAssets = 'C:/xampp/htdocs/growvidya/vidya_assets';
if (fs.existsSync(legacyVidyaAssets)) {
  app.use('/vidya_assets', express.static(legacyVidyaAssets));
}
const clientPublicAssets = path.join(__dirname, '../growvidya-client/public/vidya_assets');
if (fs.existsSync(clientPublicAssets)) {
  app.use('/vidya_assets', express.static(clientPublicAssets));
}
app.use('/vidya_assets', express.static(path.join(__dirname, 'public/vidya_assets')));

// Root Health Check Route
app.get('/api/health', (req, res) => {
  return ApiResponse.success(res, 'Growvidya REST API Server is online and healthy.', {
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// School Configuration Public/Shared Route (for dynamic footers, headers, & branding)
const GeneralSettingModel = require('./models/generalSetting.model');
const { verifyToken } = require('./utils/jwt.util');
const { pool } = require('./config/db.config');

app.get('/api/v1/school/config', async (req, res, next) => {
  try {
    let schoolId = null;

    // 1. Check query parameter explicitly passed by client
    if (req.query?.school_id) {
      const parsedId = Number(req.query.school_id);
      if (parsedId > 0) schoolId = parsedId;
    }

    // 2. If not specified in query, extract dynamically from session token
    if (!schoolId) {
      let token = null;
      if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
      } else if (req.cookies || req.signedCookies) {
        token =
          req.cookies?.growvidya_session ||
          req.signedCookies?.growvidya_session ||
          req.cookies?.token ||
          req.signedCookies?.token ||
          null;
      }

      if (token) {
        const decoded = verifyToken(token);
        if (decoded?.schoolId || decoded?.school_id) {
          schoolId = Number(decoded.schoolId || decoded.school_id);
        }
      }
    }

    // 3. If unauthenticated, fallback to the first active school in school_master
    if (!schoolId) {
      const [firstSchool] = await pool.query(
        'SELECT id FROM school_master WHERE status = 1 ORDER BY id ASC LIMIT 1'
      );
      schoolId = firstSchool[0]?.id || 1;
    }

    const configData = await GeneralSettingModel.getSchoolConfig(schoolId);
    return ApiResponse.success(res, 'School configuration fetched successfully.', configData);
  } catch (error) {
    next(error);
  }
});

// Enforce 14-day Free Trial & Subscription Active Guard across portal
app.use(subscriptionGuard);

// API Routes Mount
app.use('/api/v1/admin/auth', adminAuthRoutes);
app.use('/api/v1/admin/subscription', adminSubscriptionRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/v1/admin/academics', adminAcademicRoutes);
app.use('/api/v1/admin/teachers', adminTeacherRoutes);
app.use('/api/v1/admin/students', adminStudentRoutes);
app.use('/api/v1/admin/parents', adminParentRoutes);
app.use('/api/v1/admin/staff', adminStaffRoutes);
app.use('/api/v1/admin/attendance', adminAttendanceRoutes);
app.use('/api/v1/admin/leaves', adminLeaveRoutes);
app.use('/api/v1/admin/transport', adminTransportRoutes);
app.use('/api/v1/admin/permissions', adminPermissionRoutes);
app.use('/api/v1/admin/examinations', adminExaminationRoutes);
app.use('/api/v1/admin/fees', adminFeesRoutes);
app.use('/api/v1/admin/payroll', adminPayrollRoutes);
app.use('/api/v1/admin/hostel', adminHostelRoutes);
app.use('/api/v1/admin/announcement', adminAnnouncementRoutes);
app.use('/api/v1/admin/certificates', adminCertificateRoutes);
app.use('/api/v1/admin/reports', adminReportRoutes);
app.use('/api/v1/admin/settings', adminMiscSettingRoutes);
app.use('/api/v1/admin/idcards', adminIdCardRoutes);
app.use('/api/v1/admin/records/idcards', adminIdCardRoutes);
app.use('/api/v1/admin/dashboard', adminDashboardRoutes);
app.use('/api/v1/teacher/auth', teacherAuthRoutes);
app.use('/api/v1/teacher/dashboard', teacherDashboardRoutes);
app.use('/api/v1/teacher/academics', teacherAcademicRoutes);
app.use('/api/v1/teacher/attendance', teacherAttendanceRoutes);
app.use('/api/v1/teacher/announcements', teacherAnnouncementRoutes);
app.use('/api/v1/teacher/hostel', teacherHostelRoutes);
app.use('/api/v1/teacher/transport', teacherTransportRoutes);
app.use('/api/v1/teacher/leaves', teacherLeaveRoutes);
app.use('/api/v1/teacher/payroll', teacherPayrollRoutes);
app.use('/api/v1/parent/auth', parentAuthRoutes);
app.use('/api/v1/parent/dashboard', parentDashboardRoutes);
app.use('/api/v1/parent/child', parentChildRoutes);
app.use('/api/v1/student/auth', studentAuthRoutes);
app.use('/api/v1/student/portal', studentPortalRoutes);
app.use('/api/v1/student', studentPortalRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/common/options', commonOptionsRoutes);
app.use('/api/v1/saas', saasRoutes);
app.use('/api/saas', saasRoutes);

// Fallback resolver for static upload requests & direct attachments
app.use(async (req, res, next) => {
  if (req.method === 'GET' && req.path.startsWith('/upload/')) {
    const cleanPath = req.path.replace(/^\/upload\//, '');
    const filename = path.basename(req.path);
    const searchDirs = [
      path.join(__dirname, 'public/upload/study_material'),
      path.join(__dirname, 'public/upload/general'),
      path.join(__dirname, 'public/upload/teacher/attachment'),
      path.join(__dirname, 'public/upload/teacher'),
      path.join(__dirname, 'public/upload/student/attachment'),
      path.join(__dirname, 'public/upload/student'),
      path.join(__dirname, 'public/upload/staff'),
      path.join(__dirname, 'public/upload'),
      'C:/xampp/htdocs/growvidya/upload/study_material',
      'C:/xampp/htdocs/growvidya/upload/teacher/attachment',
      'C:/xampp/htdocs/growvidya/upload/teacher',
      'C:/xampp/htdocs/growvidya/upload/student/attachment',
      'C:/xampp/htdocs/growvidya/upload/student',
      'C:/xampp/htdocs/growvidya/upload/staff',
      'C:/xampp/htdocs/growvidya/upload',
    ];

    // 1. Direct path check in server public/upload
    const directServer = path.join(__dirname, 'public/upload', cleanPath);
    try {
      const stat = await fs.promises.stat(directServer);
      if (stat.isFile()) return res.sendFile(directServer);
    } catch (_) {}

    // 2. Direct legacy path check
    const directLegacy = path.join('C:/xampp/htdocs/growvidya/upload', cleanPath);
    try {
      const stat = await fs.promises.stat(directLegacy);
      if (stat.isFile()) return res.sendFile(directLegacy);
    } catch (_) {}

    // 3. Search directory fallback (async)
    for (const dir of searchDirs) {
      const fullPath = path.join(dir, filename);
      try {
        const stat = await fs.promises.stat(fullPath);
        if (stat.isFile()) return res.sendFile(fullPath);
      } catch (_) {}
    }
  }
  next();
});

// 404 Route Handler
app.use((req, res) => {
  return ApiResponse.error(res, `Route not found: ${req.method} ${req.originalUrl}`, null, 404);
});

// Central Error Handler
app.use(errorMiddleware);

// Server Startup & DB Connection
app.listen(config.port, async () => {
  console.log(`\n==================================================`);
  console.log(`🚀 Growvidya Server running on port: ${config.port}`);
  console.log(`🌍 Environment: ${config.nodeEnv}`);
  console.log(`🔗 Health Check: http://localhost:${config.port}/api/health`);
  console.log(`==================================================\n`);
  
  await testConnection();
});
