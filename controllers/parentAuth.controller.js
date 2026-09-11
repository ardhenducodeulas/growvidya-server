const ParentModel = require('../models/parent.model');
const { comparePassword, hashPassword } = require('../utils/password.util');
const { generateToken } = require('../utils/jwt.util');
const config = require('../config/app.config');
const ApiResponse = require('../utils/api.response');
const { pool } = require('../config/db.config');

class ParentAuthController {
  /**
   * Parent Login Controller
   * Hybrid Authentication:
   * - Web: Issues secure HTTP-Only session cookies
   * - Mobile / API: Returns Bearer JWT token in response body
   */
  static async login(req, res, next) {
    try {
      const emailOrIdentifier = req.body.email || req.body.phone || req.body.identifier || req.body.parent_id || req.body.login;
      const { password } = req.body;

      if (!emailOrIdentifier || !password) {
        return ApiResponse.error(res, 'Email / Phone Number and password are required.', null, 400);
      }

      const parent = await ParentModel.findByLoginIdentifier(emailOrIdentifier);

      if (!parent) {
        return ApiResponse.error(res, 'Invalid credentials. Parent account not found or inactive.', null, 401);
      }

      // Verify password against parent.password or parent.passcode
      let isPasswordValid = false;
      if (parent.password) {
        isPasswordValid = await comparePassword(password, parent.password);
      }
      if (!isPasswordValid && parent.passcode) {
        isPasswordValid = await comparePassword(password, parent.passcode);
      }

      if (!isPasswordValid) {
        return ApiResponse.error(res, 'Invalid credentials. Incorrect password.', null, 401);
      }

      // Fetch children
      const children = await ParentModel.getChildrenByParentId(parent.id, parent.school_id);
      const activeStudent = children.length > 0 ? children[0] : null;

      const tokenPayload = {
        userId: parent.id,
        parentId: parent.id,
        studentId: activeStudent ? activeStudent.id : null,
        schoolId: parent.school_id || 1,
        schoolName: parent.school_name || 'Growvidya School',
        schoolLogo: parent.school_logo || null,
        email: parent.email,
        phone: parent.phone,
        firstName: parent.first_name,
        lastName: parent.last_name,
        roleName: 'Parent',
        portalType: 'ParentPortal',
      };

      const token = generateToken(tokenPayload);

      // Set HTTP-Only Persistent Session Cookie for Web Clients
      const cookieOptions = {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: config.nodeEnv === 'production' ? 'none' : 'lax',
        maxAge: config.cookie?.maxAge || 30 * 24 * 60 * 60 * 1000,
        path: '/',
      };

      const cookieName = config.cookie?.name || 'growvidya_session';
      res.cookie('growvidya_parent_session', token, cookieOptions);
      res.cookie(cookieName, token, cookieOptions);
      res.cookie('token', token, cookieOptions);

      const { password: _, passcode: __, otp: ___, ...safeParent } = parent;

      return ApiResponse.success(res, 'Parent authentication successful.', {
        authType: 'hybrid (session + token)',
        token,
        parent: {
          id: safeParent.id,
          firstName: safeParent.first_name,
          lastName: safeParent.last_name,
          name: `${safeParent.first_name || ''} ${safeParent.last_name || ''}`.trim(),
          email: safeParent.email,
          phone: safeParent.phone,
          occupation: safeParent.occupation,
          relation: safeParent.relation,
          picture: safeParent.picture,
          schoolId: safeParent.school_id,
          schoolName: safeParent.school_name || 'Growvidya School',
          schoolLogo: safeParent.school_logo || null,
          roleName: 'Parent',
          portalType: 'ParentPortal',
          children: children,
          activeChild: activeStudent,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Current Parent Profile & Active Child
   */
  static async getProfile(req, res, next) {
    try {
      if (req.user.portalType && req.user.portalType !== 'ParentPortal') {
        return ApiResponse.error(res, 'Access denied. Not a parent session.', null, 401);
      }
      if (req.user.roleName !== 'Parent' && !req.user.parentId) {
        return ApiResponse.error(res, 'Access denied. Not a parent session.', null, 401);
      }

      const parentId = req.user.parentId || req.user.userId;
      const parent = await ParentModel.findAuthProfileById(parentId);

      if (!parent) {
        return ApiResponse.error(res, 'Parent profile not found.', null, 404);
      }

      const requestedStudentId = req.query.student_id ? Number(req.query.student_id) : req.user.studentId;
      const children = parent.children || [];
      const activeStudent = children.find((c) => Number(c.id) === requestedStudentId) || (children.length > 0 ? children[0] : null);

      const { password: _, passcode: __, otp: ___, ...safeParent } = parent;

      return ApiResponse.success(res, 'Parent profile fetched successfully.', {
        authSource: req.authSource || 'authenticated',
        parent: {
          id: safeParent.id,
          firstName: safeParent.first_name,
          lastName: safeParent.last_name,
          name: `${safeParent.first_name || ''} ${safeParent.last_name || ''}`.trim(),
          email: safeParent.email,
          phone: safeParent.phone,
          occupation: safeParent.occupation,
          relation: safeParent.relation,
          picture: safeParent.picture,
          schoolId: safeParent.school_id,
          schoolName: safeParent.school_name || 'Growvidya School',
          schoolLogo: safeParent.school_logo || null,
          address1: safeParent.address1 || '',
          address2: safeParent.address2 || '',
          country: safeParent.country,
          countryName: safeParent.country_name || '',
          state: safeParent.state,
          stateName: safeParent.state_name || '',
          city: safeParent.city,
          cityName: safeParent.city_name || '',
          postalCode: safeParent.postal_code || '',
          roleName: 'Parent',
          portalType: 'ParentPortal',
          children: children,
          activeChild: activeStudent,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Switch Active Child in Session
   */
  static async switchStudent(req, res, next) {
    try {
      const parentId = req.user.parentId || req.user.userId;
      const studentId = Number(req.body.student_id || req.body.studentId);

      if (!studentId) {
        return ApiResponse.error(res, 'Student ID is required.', null, 400);
      }

      const children = await ParentModel.getChildrenByParentId(parentId, req.user.schoolId);
      const matchedChild = children.find((c) => Number(c.id) === studentId);

      if (!matchedChild) {
        return ApiResponse.error(res, 'Invalid child selection. Student not linked to this parent.', null, 403);
      }

      const parent = await ParentModel.findAuthProfileById(parentId);

      const tokenPayload = {
        userId: parent.id,
        parentId: parent.id,
        studentId: matchedChild.id,
        schoolId: parent.school_id || 1,
        schoolName: parent.school_name || 'Growvidya School',
        schoolLogo: parent.school_logo || null,
        email: parent.email,
        phone: parent.phone,
        firstName: parent.first_name,
        lastName: parent.last_name,
        roleName: 'Parent',
        portalType: 'ParentPortal',
      };

      const token = generateToken(tokenPayload);

      const cookieOptions = {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: config.nodeEnv === 'production' ? 'none' : 'lax',
        maxAge: config.cookie?.maxAge || 30 * 24 * 60 * 60 * 1000,
        path: '/',
      };

      const cookieName = config.cookie?.name || 'growvidya_session';
      res.cookie('growvidya_parent_session', token, cookieOptions);
      res.cookie(cookieName, token, cookieOptions);
      res.cookie('token', token, cookieOptions);

      return ApiResponse.success(res, 'Active student switched successfully.', {
        token,
        activeChild: matchedChild,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update Parent Profile
   */
  static async updateProfile(req, res, next) {
    try {
      const parentId = req.user.parentId || req.user.userId;
      const schoolId = req.user?.schoolId;

      const {
        first_name,
        last_name,
        phone,
        email,
        occupation,
        picture,
        current_password,
        new_password,
        address1,
        address2,
        country,
        state,
        city,
        postal_code,
      } = req.body;

      const existingParent = await ParentModel.findAuthProfileById(parentId);
      if (!existingParent) {
        return ApiResponse.error(res, 'Parent profile not found.', null, 404);
      }

      let hashedPassword = undefined;
      if (new_password) {
        if (!current_password) {
          return ApiResponse.error(res, 'Current password is required to change password.', null, 400);
        }

        let isCurrentValid = false;
        if (existingParent.password) {
          isCurrentValid = await comparePassword(current_password, existingParent.password);
        }
        if (!isCurrentValid && existingParent.passcode) {
          isCurrentValid = await comparePassword(current_password, existingParent.passcode);
        }

        if (!isCurrentValid) {
          return ApiResponse.error(res, 'Current password is incorrect.', null, 400);
        }

        hashedPassword = await hashPassword(new_password);
      }

      const updatedParent = await ParentModel.updateParentProfile(parentId, schoolId, {
        first_name,
        last_name,
        phone,
        email,
        occupation,
        picture,
        password: hashedPassword,
        address1,
        address2,
        country,
        state,
        city,
        postal_code,
      });

      const { password: _, passcode: __, otp: ___, ...safeParent } = updatedParent;

      return ApiResponse.success(res, 'Profile updated successfully.', {
        parent: {
          id: safeParent.id,
          firstName: safeParent.first_name,
          lastName: safeParent.last_name,
          name: `${safeParent.first_name || ''} ${safeParent.last_name || ''}`.trim(),
          email: safeParent.email,
          phone: safeParent.phone,
          occupation: safeParent.occupation,
          relation: safeParent.relation,
          picture: safeParent.picture,
          schoolId: safeParent.school_id,
          schoolName: safeParent.school_name || 'Growvidya School',
          schoolLogo: safeParent.school_logo || null,
          address1: safeParent.address1 || '',
          address2: safeParent.address2 || '',
          country: safeParent.country,
          countryName: safeParent.country_name || '',
          state: safeParent.state,
          stateName: safeParent.state_name || '',
          city: safeParent.city,
          cityName: safeParent.city_name || '',
          postalCode: safeParent.postal_code || '',
          roleName: 'Parent',
          portalType: 'ParentPortal',
          children: safeParent.children || [],
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Parent Logout
   */
  static async logout(req, res) {
    try {
      const cookieName = config.cookie?.name || 'growvidya_session';
      const cookieOptions = {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: config.nodeEnv === 'production' ? 'none' : 'lax',
        path: '/',
      };

      res.clearCookie('growvidya_parent_session', cookieOptions);
      res.clearCookie(cookieName, cookieOptions);
      res.clearCookie('token', cookieOptions);
      res.clearCookie('session_token', cookieOptions);

      return ApiResponse.success(res, 'Parent logged out successfully.', null);
    } catch (error) {
      return ApiResponse.error(res, 'Logout encountered an error.', error.message, 500);
    }
  }
}

module.exports = ParentAuthController;
