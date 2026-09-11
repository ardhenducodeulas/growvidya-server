const TeacherModel = require('../models/teacher.model');
const { comparePassword, hashPassword } = require('../utils/password.util');
const { generateToken } = require('../utils/jwt.util');
const config = require('../config/app.config');
const ApiResponse = require('../utils/api.response');
const { pool } = require('../config/db.config');

class TeacherAuthController {
  /**
   * Teacher Login Controller
   * Hybrid Authentication:
   * - Web: Issues secure HTTP-Only session cookies
   * - Mobile / API: Returns Bearer JWT token in response body
   */
  static async login(req, res, next) {
    try {
      const emailOrIdentifier = req.body.email || req.body.identifier || req.body.teacher_id || req.body.login;
      const { password } = req.body;

      if (!emailOrIdentifier || !password) {
        return ApiResponse.error(res, 'Teacher ID / Email and password are required.', null, 400);
      }

      const teacher = await TeacherModel.findByLoginIdentifier(emailOrIdentifier);

      if (!teacher) {
        return ApiResponse.error(res, 'Invalid credentials. Teacher account not found or inactive.', null, 401);
      }

      // Verify password against teacher.password (MD5/bcrypt/plain) or teacher.passcode (bcrypt)
      let isPasswordValid = false;
      if (teacher.password) {
        isPasswordValid = await comparePassword(password, teacher.password);
      }
      if (!isPasswordValid && teacher.passcode) {
        isPasswordValid = await comparePassword(password, teacher.passcode);
      }

      if (!isPasswordValid) {
        return ApiResponse.error(res, 'Invalid credentials. Incorrect password.', null, 401);
      }

      const tokenPayload = {
        userId: teacher.id,
        teacherId: teacher.id,
        schoolId: teacher.school_id || 1,
        schoolName: teacher.school_name || 'Growvidya School',
        schoolLogo: teacher.school_logo || null,
        email: teacher.email_address,
        teacherCode: teacher.teacher_id,
        firstName: teacher.first_name,
        lastName: teacher.last_name,
        roleName: 'Teacher',
        portalType: 'TeacherPortal',
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
      res.cookie('growvidya_teacher_session', token, cookieOptions);
      res.cookie(cookieName, token, cookieOptions);
      res.cookie('token', token, cookieOptions);

      // Strip sensitive password/passcode before returning
      const { password: _, passcode: __, otp: ___, ...safeTeacher } = teacher;

      return ApiResponse.success(res, 'Teacher authentication successful.', {
        authType: 'hybrid (session + token)',
        token,
        teacher: {
          id: safeTeacher.id,
          teacherId: safeTeacher.teacher_id,
          firstName: safeTeacher.first_name,
          lastName: safeTeacher.last_name,
          name: `${safeTeacher.first_name || ''} ${safeTeacher.last_name || ''}`.trim(),
          email: safeTeacher.email_address,
          phone: safeTeacher.primary_contact_number,
          gender: safeTeacher.gender,
          picture: safeTeacher.picture,
          schoolId: safeTeacher.school_id,
          schoolName: safeTeacher.school_name || 'Growvidya School',
          schoolLogo: safeTeacher.school_logo || null,
          className: safeTeacher.class_name || null,
          sectionName: safeTeacher.section_name || null,
          subjectName: safeTeacher.subject_name || null,
          qualification: safeTeacher.qualification,
          workExperience: safeTeacher.work_experience,
          address: safeTeacher.address1,
          roleName: 'Teacher',
          portalType: 'TeacherPortal',
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Current Teacher Profile
   */
  static async getProfile(req, res, next) {
    try {
      if (req.user.portalType && req.user.portalType !== 'TeacherPortal') {
        return ApiResponse.error(res, 'Access denied. Not a teacher session.', null, 401);
      }
      if (req.user.roleName !== 'Teacher' && !req.user.teacherId) {
        return ApiResponse.error(res, 'Access denied. Not a teacher session.', null, 401);
      }

      const teacherId = req.user.teacherId || req.user.userId;
      const teacher = await TeacherModel.findAuthProfileById(teacherId);

      if (!teacher) {
        return ApiResponse.error(res, 'Teacher profile not found.', null, 404);
      }

      const { password: _, passcode: __, otp: ___, ...safeTeacher } = teacher;

      return ApiResponse.success(res, 'Teacher profile fetched successfully.', {
        authSource: req.authSource || 'authenticated',
        teacher: {
          id: safeTeacher.id,
          teacherId: safeTeacher.teacher_id,
          firstName: safeTeacher.first_name,
          lastName: safeTeacher.last_name,
          name: `${safeTeacher.first_name || ''} ${safeTeacher.last_name || ''}`.trim(),
          email: safeTeacher.email_address,
          phone: safeTeacher.primary_contact_number,
          gender: safeTeacher.gender,
          picture: safeTeacher.picture,
          schoolId: safeTeacher.school_id,
          schoolName: safeTeacher.school_name || 'Growvidya School',
          schoolLogo: safeTeacher.school_logo || null,
          className: safeTeacher.class_name || null,
          sectionName: safeTeacher.section_name || null,
          subjectName: safeTeacher.subject_name || null,
          classAssignments: safeTeacher.class_assignments || [],
          qualification: safeTeacher.qualification,
          workExperience: safeTeacher.work_experience,
          dateOfBirth: safeTeacher.date_of_birth,
          dateOfJoining: safeTeacher.date_of_joining,
          bloodGroup: safeTeacher.blood_group,
          bloodGroupName: safeTeacher.blood_group_name || safeTeacher.blood_group || '',
          maritalStatus: safeTeacher.marital_status,
          maritalStatusName: safeTeacher.marital_status_name || safeTeacher.marital_status || '',
          address1: safeTeacher.address1,
          address2: safeTeacher.address2,
          country: safeTeacher.country,
          countryName: safeTeacher.country_name,
          state: safeTeacher.state,
          stateName: safeTeacher.state_name,
          city: safeTeacher.city,
          cityName: safeTeacher.city_name,
          postalCode: safeTeacher.postal_code,
          roleName: 'Teacher',
          portalType: 'TeacherPortal',
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update Current Teacher Profile
   */
  static async updateProfile(req, res, next) {
    try {
      const teacherId = req.user.teacherId || req.user.userId;
      const schoolId = req.user?.schoolId;

      const {
        first_name,
        last_name,
        primary_contact_number,
        email_address,
        gender,
        date_of_birth,
        blood_group,
        marital_status,
        qualification,
        work_experience,
        address1,
        address2,
        country,
        state,
        city,
        postal_code,
        picture,
        current_password,
        new_password,
      } = req.body;

      const existingTeacher = await TeacherModel.findAuthProfileById(teacherId);
      if (!existingTeacher) {
        return ApiResponse.error(res, 'Teacher profile not found.', null, 404);
      }

      const updates = [];
      const params = [];

      if (first_name !== undefined) {
        updates.push('first_name = ?');
        params.push(first_name.trim());
      }
      if (last_name !== undefined) {
        updates.push('last_name = ?');
        params.push(last_name.trim());
      }
      if (primary_contact_number !== undefined) {
        updates.push('primary_contact_number = ?');
        params.push(primary_contact_number.trim());
      }
      if (email_address !== undefined) {
        updates.push('email_address = ?');
        params.push(email_address.trim());
      }
      if (gender !== undefined) {
        let normalizedGender = 1;
        if (gender === '2' || gender === 2 || String(gender).toLowerCase().includes('fem')) {
          normalizedGender = 2;
        } else if (gender === '3' || gender === 3 || String(gender).toLowerCase().includes('oth')) {
          normalizedGender = 3;
        }
        updates.push('gender = ?');
        params.push(normalizedGender);
      }
      if (date_of_birth !== undefined) {
        updates.push('date_of_birth = ?');
        params.push(date_of_birth || null);
      }
      if (blood_group !== undefined) {
        updates.push('blood_group = ?');
        params.push(blood_group || null);
      }
      if (marital_status !== undefined) {
        updates.push('marital_status = ?');
        params.push(marital_status || null);
      }
      if (qualification !== undefined) {
        updates.push('qualification = ?');
        params.push(qualification || null);
      }
      if (work_experience !== undefined) {
        updates.push('work_experience = ?');
        params.push(work_experience || null);
      }
      if (address1 !== undefined) {
        updates.push('address1 = ?');
        params.push(address1 || null);
      }
      if (picture !== undefined) {
        updates.push('picture = ?');
        params.push(picture || null);
      }

      // Handle Password Change if requested
      if (new_password) {
        if (!current_password) {
          return ApiResponse.error(res, 'Current password is required to set a new password.', null, 400);
        }
        const isMatch = await comparePassword(current_password, existingTeacher.password);
        if (!isMatch && current_password !== existingTeacher.passcode && current_password !== existingTeacher.password) {
          return ApiResponse.error(res, 'Current password is incorrect.', null, 400);
        }
        const hashedPassword = await hashPassword(new_password);
        updates.push('password = ?');
        params.push(hashedPassword);
        updates.push('passcode = ?');
        params.push(new_password);
      }

      if (updates.length > 0) {
        params.push(teacherId);
        await pool.query(`UPDATE teacher_master SET ${updates.join(', ')} WHERE id = ?`, params);
      }

      // Sync teacher_address table
      if (
        country !== undefined ||
        state !== undefined ||
        city !== undefined ||
        postal_code !== undefined ||
        address1 !== undefined ||
        address2 !== undefined
      ) {
        try {
          const [addrRows] = await pool.query(
            'SELECT id FROM teacher_address WHERE teacher_id = ? AND address_type = 1 LIMIT 1',
            [teacherId]
          );

          if (addrRows && addrRows.length > 0) {
            const addrUpdates = [];
            const addrParams = [];
            if (address1 !== undefined) {
              addrUpdates.push('address1 = ?');
              addrParams.push(address1 || '');
            }
            if (address2 !== undefined) {
              addrUpdates.push('address2 = ?');
              addrParams.push(address2 || '');
            }
            if (country !== undefined) {
              addrUpdates.push('country = ?');
              addrParams.push(country || null);
            }
            if (state !== undefined) {
              addrUpdates.push('state = ?');
              addrParams.push(state || null);
            }
            if (city !== undefined) {
              addrUpdates.push('city = ?');
              addrParams.push(city || null);
            }
            if (postal_code !== undefined) {
              addrUpdates.push('postal_code = ?');
              addrParams.push(postal_code || '');
            }

            if (addrUpdates.length > 0) {
              addrParams.push(teacherId);
              await pool.query(
                `UPDATE teacher_address SET ${addrUpdates.join(', ')} WHERE teacher_id = ? AND address_type = 1`,
                addrParams
              );
            }
          } else {
            await pool.query(
              `INSERT INTO teacher_address 
               (school_id, teacher_id, address1, address2, country, state, city, postal_code, same_permanent, address_type, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 1)`,
              [
                schoolId,
                teacherId,
                address1 || '',
                address2 || '',
                country || null,
                state || null,
                city || null,
                postal_code || '',
              ]
            );
          }
        } catch (addrErr) {
          console.error('Error updating teacher_address:', addrErr.message);
        }
      }

      // Fetch refreshed teacher profile
      const updatedTeacher = await TeacherModel.findAuthProfileById(teacherId);
      const { password: _, passcode: __, otp: ___, ...safeTeacher } = updatedTeacher;

      return ApiResponse.success(res, 'Teacher profile updated successfully.', {
        teacher: {
          id: safeTeacher.id,
          teacherId: safeTeacher.teacher_id,
          firstName: safeTeacher.first_name,
          lastName: safeTeacher.last_name,
          name: `${safeTeacher.first_name || ''} ${safeTeacher.last_name || ''}`.trim(),
          email: safeTeacher.email_address,
          phone: safeTeacher.primary_contact_number,
          gender: safeTeacher.gender,
          picture: safeTeacher.picture,
          schoolId: safeTeacher.school_id,
          schoolName: safeTeacher.school_name || 'Growvidya School',
          schoolLogo: safeTeacher.school_logo || null,
          className: safeTeacher.class_name || null,
          sectionName: safeTeacher.section_name || null,
          subjectName: safeTeacher.subject_name || null,
          classAssignments: safeTeacher.class_assignments || [],
          qualification: safeTeacher.qualification,
          workExperience: safeTeacher.work_experience,
          dateOfBirth: safeTeacher.date_of_birth,
          dateOfJoining: safeTeacher.date_of_joining,
          bloodGroup: safeTeacher.blood_group,
          bloodGroupName: safeTeacher.blood_group_name || safeTeacher.blood_group || '',
          maritalStatus: safeTeacher.marital_status,
          maritalStatusName: safeTeacher.marital_status_name || safeTeacher.marital_status || '',
          address1: safeTeacher.address1,
          address2: safeTeacher.address2,
          country: safeTeacher.country,
          countryName: safeTeacher.country_name,
          state: safeTeacher.state,
          stateName: safeTeacher.state_name,
          city: safeTeacher.city,
          cityName: safeTeacher.city_name,
          postalCode: safeTeacher.postal_code,
          roleName: 'Teacher',
          portalType: 'TeacherPortal',
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Teacher Logout Controller
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

      res.clearCookie('growvidya_teacher_session', cookieOptions);
      res.clearCookie(cookieName, cookieOptions);
      res.clearCookie('token', cookieOptions);
      res.clearCookie('session_token', cookieOptions);

      return ApiResponse.success(res, 'Teacher logged out successfully. Session cleared.');
    } catch (error) {
      return ApiResponse.error(res, 'Failed to logout cleanly.', error.message, 500);
    }
  }
}

module.exports = TeacherAuthController;
