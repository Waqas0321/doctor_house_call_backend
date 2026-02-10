const jwt = require('jsonwebtoken');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { createAuditLog } = require('../services/auditService');

// Generate JWT Token
const generateToken = (id) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

/**
 * Social auth handler - shared logic for Google, Facebook, Apple
 */
const handleSocialAuth = async (provider, req, res, next) => {
  try {
    const { providerUserId, email, firstName, lastName, profilePicture } = req.body;

    if (!providerUserId) {
      return res.status(400).json({
        success: false,
        error: 'Provider user ID is required'
      });
    }

    // Find or create user
    let user = await User.findOne({
      authProvider: provider,
      providerUserId
    });

    if (user) {
      // Update user info if provided
      if (email) user.email = email;
      if (firstName) user.firstName = firstName;
      if (lastName) user.lastName = lastName;
      if (profilePicture) user.profilePicture = profilePicture;
      await user.save();
    } else {
      // Create new user
      user = await User.create({
        authProvider: provider,
        providerUserId,
        email,
        firstName,
        lastName,
        profilePicture
      });

      await createAuditLog({
        action: 'user_created',
        userId: user._id,
        entityType: 'user',
        entityId: user._id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePicture: user.profilePicture
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Register/Login user with OAuth (generic)
 * @route   POST /api/auth/oauth
 * @access  Public
 */
exports.oauthLogin = async (req, res, next) => {
  const { provider } = req.body;
  if (!provider || !['google', 'facebook', 'apple'].includes(provider)) {
    return res.status(400).json({
      success: false,
      error: 'Provider (google, facebook, or apple) is required'
    });
  }
  return handleSocialAuth(provider, req, res, next);
};

/**
 * @desc    Google Sign-In (App)
 * @route   POST /api/auth/google
 * @access  Public
 */
exports.googleAuth = (req, res, next) => handleSocialAuth('google', req, res, next);

/**
 * @desc    Facebook Login (App)
 * @route   POST /api/auth/facebook
 * @access  Public
 */
exports.facebookAuth = (req, res, next) => handleSocialAuth('facebook', req, res, next);

/**
 * @desc    Sign in with Apple (App)
 * @route   POST /api/auth/apple
 * @access  Public
 */
exports.appleAuth = (req, res, next) => handleSocialAuth('apple', req, res, next);

/**
 * @desc    Get current user
 * @route   GET /api/auth/me
 * @access  Private
 */
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-devices');

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Register user with email/password
 * @route   POST /api/auth/register
 * @access  Public
 */
exports.register = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, phone, address } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User already exists with this email'
      });
    }

    // Create user
    const user = await User.create({
      authProvider: 'email',
      email: email.toLowerCase(),
      password,
      firstName,
      lastName,
      phone,
      address,
      isAdmin: false
    });

    const token = generateToken(user._id);

    await createAuditLog({
      action: 'user_created',
      userId: user._id,
      entityType: 'user',
      entityId: user._id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'User already exists with this email'
      });
    }
    next(error);
  }
};

/**
 * @desc    Register admin user
 * @route   POST /api/auth/register-admin
 * @access  Public (should be protected in production)
 */
exports.registerAdmin = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, phone, address } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User already exists with this email'
      });
    }

    // Create admin user
    const user = await User.create({
      authProvider: 'email',
      email: email.toLowerCase(),
      password,
      firstName,
      lastName,
      phone,
      address,
      isAdmin: true
    });

    const token = generateToken(user._id);

    await createAuditLog({
      action: 'admin_created',
      userId: user._id,
      entityType: 'user',
      entityId: user._id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'User already exists with this email'
      });
    }
    next(error);
  }
};

/**
 * @desc    Login user with email/password
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // Check if JWT_SECRET is set
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not defined in environment variables');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error'
      });
    }

    // Check database connection
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      console.error('Database not connected. ReadyState:', mongoose.connection.readyState);
      return res.status(500).json({
        success: false,
        error: 'Database connection error. Please try again later.'
      });
    }

    // Find user and include password
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Account is inactive'
      });
    }

    // Check if user has password (for email/password users)
    if (!user.password) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    const token = generateToken(user._id);

    // Create audit log (non-blocking)
    createAuditLog({
      action: 'user_login',
      userId: user._id,
      entityType: 'user',
      entityId: user._id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch(err => {
      console.error('Failed to create audit log:', err);
      // Don't fail the login if audit log fails
    });

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    next(error);
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/auth/profile
 * @access  Private
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const { phone, email, firstName, lastName, address } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (phone) user.phone = phone;
    if (email) user.email = email;
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (address !== undefined) user.address = address;

    await user.save();

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete account (soft delete – deactivates user, anonymizes data)
 * @route   DELETE /api/auth/account
 * @access  Private
 */
exports.deleteAccount = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    user.isActive = false;
    user.email = user.email ? `deleted_${user._id}@deleted.local` : undefined;
    user.providerUserId = undefined;
    user.password = undefined;
    user.firstName = undefined;
    user.lastName = undefined;
    user.phone = undefined;
    user.address = undefined;
    user.profilePicture = undefined;
    user.devices = [];
    await user.save({ validateBeforeSave: false });

    await createAuditLog({
      action: 'account_deleted',
      userId: user._id,
      entityType: 'user',
      entityId: user._id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(200).json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

