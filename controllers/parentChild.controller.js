const ParentModel = require('../models/parent.model');
const ApiResponse = require('../utils/api.response');

class ParentChildController {
  // Helper to determine studentId
  static async getActiveStudentId(req) {
    const parentId = req.user.parentId || req.user.userId;
    const requestedStudentId = req.query.student_id ? Number(req.query.student_id) : (req.body.student_id ? Number(req.body.student_id) : req.user.studentId);
    
    if (requestedStudentId) return requestedStudentId;

    const children = await ParentModel.getChildrenByParentId(parentId, req.user.schoolId);
    return children.length > 0 ? children[0].id : null;
  }

  /**
   * Get Academic Years for Parent
   */
  static async getAcademicYears(req, res, next) {
    try {
      const AcademicModel = require('../models/academic.model');
      const schoolId = req.user?.schoolId;
      const data = await AcademicModel.getAcademicYears(schoolId);
      return ApiResponse.success(res, 'Academic years fetched successfully.', data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Active Child Profile
   */
  static async getProfile(req, res, next) {
    try {
      const studentId = await ParentChildController.getActiveStudentId(req);
      if (!studentId) {
        return ApiResponse.error(res, 'No linked child student found.', null, 404);
      }

      const student = await ParentModel.getChildFullProfile(studentId, req.user.schoolId);
      if (!student) {
        return ApiResponse.error(res, 'Student profile not found.', null, 404);
      }

      return ApiResponse.success(res, 'Child profile fetched successfully.', student);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update Child Profile
   */
  static async updateProfile(req, res, next) {
    try {
      const studentId = await ParentChildController.getActiveStudentId(req);
      if (!studentId) {
        return ApiResponse.error(res, 'No linked child student found.', null, 404);
      }

      const updated = await ParentModel.updateChildProfile(
        studentId,
        req.user.schoolId,
        req.user.id || req.user.parentId,
        req.body
      );

      return ApiResponse.success(res, 'Student profile updated successfully.', updated);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Child Attendance
   */
  static async getAttendance(req, res, next) {
    try {
      const studentId = await ParentChildController.getActiveStudentId(req);
      if (!studentId) {
        return ApiResponse.error(res, 'No linked child student found.', null, 404);
      }

      const { month, year } = req.query;
      const data = await ParentModel.getChildAttendance(studentId, req.user.schoolId, { month, year });

      return ApiResponse.success(res, 'Child attendance fetched successfully.', data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Child Fees
   */
  static async getFees(req, res, next) {
    try {
      const studentId = await ParentChildController.getActiveStudentId(req);
      if (!studentId) {
        return ApiResponse.error(res, 'No linked child student found.', null, 404);
      }

      const data = await ParentModel.getChildFees(studentId, req.user.schoolId);
      return ApiResponse.success(res, 'Child fees fetched successfully.', data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Pay Child Fee (Parent Portal Online Payment)
   */
  static async payFee(req, res, next) {
    try {
      const studentId = await ParentChildController.getActiveStudentId(req);
      if (!studentId) {
        return ApiResponse.error(res, 'No linked child student found.', null, 404);
      }

      const schoolId = req.user?.schoolId;
      const { invoiceId, amountPaid, paymentMethod, referenceNo, notes } = req.body;

      if (!invoiceId || !amountPaid) {
        return ApiResponse.error(res, 'Invoice ID and Amount Paid are required.', null, 400);
      }

      const AdminFeesModel = require('../models/adminFees.model');
      const result = await AdminFeesModel.recordPayment({
        schoolId,
        studentId,
        invoiceId: Number(invoiceId),
        amountPaid: parseFloat(amountPaid),
        paymentMethod: paymentMethod || 'UPI / Online Transfer',
        referenceNo: referenceNo || `TXN-P-${Date.now()}`,
        notes: notes || 'Parent Portal Payment',
        collectedBy: 0,
      });

      return ApiResponse.success(res, 'Fee payment completed successfully.', result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Child Exam Results
   */
  static async getExamResults(req, res, next) {
    try {
      const studentId = await ParentChildController.getActiveStudentId(req);
      if (!studentId) {
        return ApiResponse.error(res, 'No linked child student found.', null, 404);
      }

      const data = await ParentModel.getChildExamResults(studentId, req.user.schoolId);
      return ApiResponse.success(res, 'Child exam results fetched successfully.', data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Child Study Materials
   */
  static async getStudyMaterials(req, res, next) {
    try {
      const studentId = await ParentChildController.getActiveStudentId(req);
      if (!studentId) {
        return ApiResponse.error(res, 'No linked child student found.', null, 404);
      }

      const student = await ParentModel.getChildFullProfile(studentId, req.user.schoolId);
      const classId = student ? (student.class || student.class_id || student.classId) : null;

      const data = await ParentModel.getChildStudyMaterials(studentId, req.user.schoolId, classId);
      return ApiResponse.success(res, 'Child study materials fetched successfully.', data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Material Types
   */
  static async getMaterialTypes(req, res, next) {
    try {
      const AcademicModel = require('../models/academic.model');
      const schoolId = req.user?.schoolId;
      const data = await AcademicModel.getMaterialTypes(schoolId);
      return ApiResponse.success(res, 'Material types fetched successfully.', data?.material_types || data || []);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Child Timetable
   */
  static async getTimetable(req, res, next) {
    try {
      const studentId = await ParentChildController.getActiveStudentId(req);
      if (!studentId) {
        return ApiResponse.error(res, 'No linked child student found.', null, 404);
      }

      const student = await ParentModel.getChildFullProfile(studentId, req.user.schoolId);
      const classId = req.query.class_id || (student ? student.class : null);
      const sectionId = req.query.section_id || (student ? student.section : null);

      let data = await ParentModel.getChildTimetable(studentId, req.user.schoolId, classId, sectionId);

      // If no routines found for specific section, try class-level routines
      if ((!data || data.length === 0) && classId && sectionId) {
        const classRoutines = await ParentModel.getChildTimetable(studentId, req.user.schoolId, classId, null);
        if (classRoutines && classRoutines.length > 0) {
          data = classRoutines;
        }
      }

      return ApiResponse.success(res, 'Child timetable fetched successfully.', data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Child Transport
   */
  static async getTransport(req, res, next) {
    try {
      const studentId = await ParentChildController.getActiveStudentId(req);
      if (!studentId) {
        return ApiResponse.error(res, 'No linked child student found.', null, 404);
      }

      const data = await ParentModel.getChildTransport(studentId, req.user.schoolId);
      return ApiResponse.success(res, 'Child transport fetched successfully.', data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Child Hostel
   */
  static async getHostel(req, res, next) {
    try {
      const studentId = await ParentChildController.getActiveStudentId(req);
      if (!studentId) {
        return ApiResponse.error(res, 'No linked child student found.', null, 404);
      }

      const data = await ParentModel.getChildHostel(studentId, req.user.schoolId);
      return ApiResponse.success(res, 'Child hostel fetched successfully.', data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Child Medical History
   */
  static async getMedical(req, res, next) {
    try {
      const studentId = await ParentChildController.getActiveStudentId(req);
      if (!studentId) {
        return ApiResponse.error(res, 'No linked child student found.', null, 404);
      }

      const data = await ParentModel.getChildMedical(studentId, req.user.schoolId);
      return ApiResponse.success(res, 'Child medical history fetched successfully.', data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Child Activity Log
   */
  static async getActivities(req, res, next) {
    try {
      const studentId = await ParentChildController.getActiveStudentId(req);
      if (!studentId) {
        return ApiResponse.error(res, 'No linked child student found.', null, 404);
      }

      const data = await ParentModel.getChildActivities(studentId, req.user.schoolId);
      return ApiResponse.success(res, 'Child activities fetched successfully.', data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Child Uploaded Documents
   */
  static async getDocuments(req, res, next) {
    try {
      const studentId = await ParentChildController.getActiveStudentId(req);
      if (!studentId) {
        return ApiResponse.error(res, 'No linked child student found.', null, 404);
      }

      const data = await ParentModel.getChildDocuments(studentId, req.user.schoolId);
      return ApiResponse.success(res, 'Child documents fetched successfully.', data);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ParentChildController;
