import User from '../models/User.model.js';
import { getSupabaseAdmin, getSupabase } from '../config/supabase.js';
import bcrypt from 'bcryptjs';

// @desc    Get current user profile (for token validation)
// @route   GET /api/users/profile
// @access  Private
export const getProfile = async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();
    
    // Get user by ID from authenticated request
    // NOTE: users table does NOT have 'name' or 'phone' columns
    // These are in the profiles table
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, role, created_at')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      console.error('Error fetching user profile:', error);
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    // Get profile data (name, phone) from profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name, phone')
      .eq('user_id', req.user.id)
      .single();

    // Build name from profile or use email
    const name = profile 
      ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || user.email.split('@')[0]
      : user.email.split('@')[0];

    // Return combined user data
    const userData = {
      id: user.id,
      name: name,
      email: user.email,
      phone: profile?.phone || null,
      role: user.role,
      created_at: user.created_at,
    };

    res.status(200).json({
      status: 'success',
      data: { user: userData },
    });
  } catch (error) {
    console.error('getProfile error:', error);
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
export const updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    user.phone = req.body.phone || user.phone;

    const updatedUser = await user.save();

    res.status(200).json({
      status: 'success',
      data: { user: updatedUser },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get addresses
// @route   GET /api/users/addresses
// @access  Private
export const getAddresses = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    res.status(200).json({
      status: 'success',
      data: { addresses: user.addresses || [] },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add address
// @route   POST /api/users/addresses
// @access  Private
export const addAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    const address = req.body;

    // If this is the first address or marked as default, set as default
    if (user.addresses.length === 0 || address.isDefault) {
      user.addresses.forEach((addr) => (addr.isDefault = false));
      address.isDefault = true;
    }

    user.addresses.push(address);
    await user.save();

    res.status(201).json({
      status: 'success',
      data: { addresses: user.addresses },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update address
// @route   PUT /api/users/addresses/:addressId
// @access  Private
export const updateAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    const address = user.addresses.id(req.params.addressId);

    if (!address) {
      return res.status(404).json({
        status: 'error',
        message: 'Address not found',
      });
    }

    Object.assign(address, req.body);

    // If marked as default, unset others
    if (req.body.isDefault) {
      user.addresses.forEach((addr) => {
        if (addr._id.toString() !== req.params.addressId) {
          addr.isDefault = false;
        }
      });
    }

    await user.save();

    res.status(200).json({
      status: 'success',
      data: { addresses: user.addresses },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete address
// @route   DELETE /api/users/addresses/:addressId
// @access  Private
export const deleteAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    user.addresses = user.addresses.filter(
      (addr) => addr._id.toString() !== req.params.addressId
    );

    await user.save();

    res.status(200).json({
      status: 'success',
      data: { addresses: user.addresses },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add to wishlist
// @route   POST /api/users/wishlist/:productId
// @access  Private
export const addToWishlist = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    if (user.wishlist.includes(req.params.productId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Product already in wishlist',
      });
    }

    user.wishlist.push(req.params.productId);
    await user.save();

    const populatedUser = await User.findById(req.user.id).populate('wishlist');

    res.status(200).json({
      status: 'success',
      data: { wishlist: populatedUser.wishlist },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove from wishlist
// @route   DELETE /api/users/wishlist/:productId
// @access  Private
export const removeFromWishlist = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    user.wishlist = user.wishlist.filter(
      (id) => id.toString() !== req.params.productId
    );

    await user.save();

    const populatedUser = await User.findById(req.user.id).populate('wishlist');

    res.status(200).json({
      status: 'success',
      data: { wishlist: populatedUser.wishlist },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get wishlist
// @route   GET /api/users/wishlist
// @access  Private
export const getWishlist = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate('wishlist');

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    res.status(200).json({
      status: 'success',
      data: { wishlist: user.wishlist },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all users with commerce activity data
// @route   GET /api/users
// @access  Private/Admin
export const getUsers = async (req, res, next) => {
  try {
    const supabase = getSupabase();
    
    // Get all users with basic info
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, email, phone, role, created_at, last_login, updated_at')
      .order('created_at', { ascending: false });

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch users',
      });
    }

    // Get all orders to calculate user statistics
    const { data: allOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id, user_id, total_price, payment_status, order_status, payment_method, created_at, is_paid, order_items');

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      // Continue even if orders fail
    }

    // Calculate statistics for each user
    const usersWithStats = users.map(user => {
      const userOrders = (allOrders || []).filter(order => order.user_id === user.id);
      
      // Calculate total spent (only paid orders)
      const totalSpent = userOrders.reduce((sum, order) => {
        const isPaid = order.is_paid || order.payment_status === 'paid';
        return sum + (isPaid ? Number(order.total_price || 0) : 0);
      }, 0);

      // Get order counts by status
      const ordersByStatus = {
        pending: userOrders.filter(o => o.order_status === 'Pending').length,
        confirmed: userOrders.filter(o => o.order_status === 'Confirmed').length,
        processing: userOrders.filter(o => o.order_status === 'Processing').length,
        packed: userOrders.filter(o => o.order_status === 'Packed').length,
        shipped: userOrders.filter(o => o.order_status === 'Shipped').length,
        delivered: userOrders.filter(o => o.order_status === 'Delivered').length,
        cancelled: userOrders.filter(o => o.order_status === 'Cancelled').length,
        returned: userOrders.filter(o => o.order_status === 'Returned').length,
        refunded: userOrders.filter(o => o.order_status === 'Refunded').length,
      };

      // Get payment method breakdown
      const codOrders = userOrders.filter(o => o.payment_method === 'COD').length;
      const prepaidOrders = userOrders.filter(o => o.payment_method !== 'COD').length;

      // Get last order date
      const lastOrder = userOrders.length > 0 
        ? new Date(Math.max(...userOrders.map(o => new Date(o.created_at).getTime())))
        : null;

      return {
        ...user,
        stats: {
          totalOrders: userOrders.length,
          totalSpent: Math.round(totalSpent * 100) / 100,
          lastOrderDate: lastOrder ? lastOrder.toISOString() : null,
          ordersByStatus,
          codOrders,
          prepaidOrders,
        }
      };
    });

    console.log(`📊 Fetched ${usersWithStats.length} users with activity data`);

    res.status(200).json({
      status: 'success',
      data: { users: usersWithStats },
    });
  } catch (error) {
    console.error('getUsers error:', error);
    next(error);
  }
};

// @desc    Get user by ID with complete order history
// @route   GET /api/users/:id
// @access  Private/Admin
export const getUserById = async (req, res, next) => {
  try {
    const supabase = getSupabase();
    const { id } = req.params;

    // Get user details
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, email, phone, role, created_at, last_login, updated_at')
      .eq('id', id)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    // Get user's complete order history
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false });

    if (ordersError) {
      console.error('Error fetching user orders:', ordersError);
    }

    // Calculate comprehensive statistics
    const userOrders = orders || [];
    
    const totalSpent = userOrders.reduce((sum, order) => {
      const isPaid = order.is_paid || order.payment_status === 'paid';
      return sum + (isPaid ? Number(order.total_price || 0) : 0);
    }, 0);

    const ordersByStatus = {
      pending: userOrders.filter(o => o.order_status === 'Pending').length,
      confirmed: userOrders.filter(o => o.order_status === 'Confirmed').length,
      processing: userOrders.filter(o => o.order_status === 'Processing').length,
      packed: userOrders.filter(o => o.order_status === 'Packed').length,
      shipped: userOrders.filter(o => o.order_status === 'Shipped').length,
      delivered: userOrders.filter(o => o.order_status === 'Delivered').length,
      cancelled: userOrders.filter(o => o.order_status === 'Cancelled').length,
      returned: userOrders.filter(o => o.order_status === 'Returned').length,
      refunded: userOrders.filter(o => o.order_status === 'Refunded').length,
    };

    const paymentBreakdown = {
      cod: userOrders.filter(o => o.payment_method === 'COD').length,
      prepaid: userOrders.filter(o => o.payment_method !== 'COD').length,
    };

    const lastOrder = userOrders.length > 0 ? userOrders[0] : null;

    // Calculate items purchased
    let totalItemsPurchased = 0;
    const productsPurchased = {};
    
    userOrders.forEach(order => {
      const items = order.order_items || [];
      items.forEach(item => {
        const qty = Number(item.quantity || 0);
        totalItemsPurchased += qty;
        
        const productName = item.productName || item.name || 'Unknown Product';
        if (!productsPurchased[productName]) {
          productsPurchased[productName] = 0;
        }
        productsPurchased[productName] += qty;
      });
    });

    // Format response
    const userWithDetails = {
      ...user,
      stats: {
        totalOrders: userOrders.length,
        totalSpent: Math.round(totalSpent * 100) / 100,
        totalItemsPurchased,
        lastOrderDate: lastOrder ? lastOrder.created_at : null,
        lastOrderNumber: lastOrder ? lastOrder.order_number : null,
        ordersByStatus,
        paymentBreakdown,
        topProducts: Object.entries(productsPurchased)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, qty]) => ({ name, quantity: qty })),
      },
      orders: userOrders,
    };

    console.log(`📊 Fetched user ${user.email} with ${userOrders.length} orders`);

    res.status(200).json({
      status: 'success',
      data: { user: userWithDetails },
    });
  } catch (error) {
    console.error('getUserById error:', error);
    next(error);
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/Admin
export const updateUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    user.role = req.body.role || user.role;
    user.isActive = req.body.isActive !== undefined ? req.body.isActive : user.isActive;

    const updatedUser = await user.save();

    res.status(200).json({
      status: 'success',
      data: { user: updatedUser },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
export const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    await user.deleteOne();

    res.status(200).json({
      status: 'success',
      message: 'User deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user settings
// @route   GET /api/users/settings
// @access  Private
export const getSettings = async (req, res, next) => {
  try {
    const supabase = getSupabase();
    const { data: user, error } = await supabase
      .from('users')
      .select('settings')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    // Return settings or defaults
    const settings = user.settings || {
      emailNotifications: true,
      smsNotifications: false,
      orderUpdates: true,
      promotions: true,
      darkMode: false,
      language: 'en',
      currency: 'USD',
    };

    res.status(200).json({
      status: 'success',
      data: { settings },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user settings
// @route   PUT /api/users/settings
// @access  Private
export const updateSettings = async (req, res, next) => {
  try {
    const supabase = getSupabase();
    
    // First get current settings
    const { data: currentUser, error: fetchError } = await supabase
      .from('users')
      .select('settings')
      .eq('id', req.user.id)
      .single();

    if (fetchError || !currentUser) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    // Merge with new settings
    const updatedSettings = {
      ...(currentUser.settings || {}),
      ...req.body,
    };

    // Update settings
    const { data: user, error } = await supabase
      .from('users')
      .update({ 
        settings: updatedSettings,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.user.id)
      .select('settings')
      .single();

    if (error) {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to update settings',
      });
    }

    res.status(200).json({
      status: 'success',
      data: { settings: user.settings },
      message: 'Settings updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Change password
// @route   PUT /api/users/change-password
// @access  Private
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const supabase = getSupabase();

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'Current password and new password are required',
      });
    }

    // Password strength validation
    if (newPassword.length < 8) {
      return res.status(400).json({
        status: 'error',
        message: 'New password must be at least 8 characters long',
      });
    }

    // Get user with password
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('id, email, password')
      .eq('id', req.user.id)
      .single();

    if (fetchError || !user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({
        status: 'error',
        message: 'Current password is incorrect',
      });
    }

    // Check if new password is same as current
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        status: 'error',
        message: 'New password must be different from current password',
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        password: hashedPassword,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.user.id);

    if (updateError) {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to update password',
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update privacy settings
// @route   PUT /api/users/privacy
// @access  Private
export const updatePrivacySettings = async (req, res, next) => {
  try {
    const supabase = getSupabase();
    const { profileVisibility, marketingEmails, dataPersonalization } = req.body;

    // Get current settings
    const { data: currentUser, error: fetchError } = await supabase
      .from('users')
      .select('settings')
      .eq('id', req.user.id)
      .single();

    if (fetchError || !currentUser) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    // Update privacy settings
    const updatedSettings = {
      ...(currentUser.settings || {}),
      privacy: {
        ...(currentUser.settings?.privacy || {}),
        profileVisibility: profileVisibility !== undefined ? profileVisibility : currentUser.settings?.privacy?.profileVisibility,
        marketingEmails: marketingEmails !== undefined ? marketingEmails : currentUser.settings?.privacy?.marketingEmails,
        dataPersonalization: dataPersonalization !== undefined ? dataPersonalization : currentUser.settings?.privacy?.dataPersonalization,
      }
    };

    const { data: user, error } = await supabase
      .from('users')
      .update({ 
        settings: updatedSettings,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.user.id)
      .select('settings')
      .single();

    if (error) {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to update privacy settings',
      });
    }

    res.status(200).json({
      status: 'success',
      data: { settings: user.settings },
      message: 'Privacy settings updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user account
// @route   DELETE /api/users/account
// @access  Private
export const deleteAccount = async (req, res, next) => {
  try {
    const { password } = req.body;
    const supabase = getSupabase();

    if (!password) {
      return res.status(400).json({
        status: 'error',
        message: 'Password is required to delete account',
      });
    }

    // Get user with password
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('id, email, password')
      .eq('id', req.user.id)
      .single();

    if (fetchError || !user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        status: 'error',
        message: 'Password is incorrect',
      });
    }

    // Delete user account (cascade delete should handle related data)
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', req.user.id);

    if (deleteError) {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to delete account',
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Account deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get saved payment methods
// @route   GET /api/users/payment-methods
// @access  Private
export const getPaymentMethods = async (req, res, next) => {
  try {
    const supabase = getSupabase();

    const { data: paymentMethods, error } = await supabase
      .from('saved_payment_methods')
      .select('*')
      .eq('user_id', req.user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching payment methods:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch payment methods',
      });
    }

    res.status(200).json({
      status: 'success',
      data: { paymentMethods: paymentMethods || [] },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add payment method
// @route   POST /api/users/payment-methods
// @access  Private
export const addPaymentMethod = async (req, res, next) => {
  try {
    const { paymentType, token, lastFour, cardBrand, expiryMonth, expiryYear, isDefault } = req.body;
    const supabase = getSupabase();

    if (!paymentType || !token) {
      return res.status(400).json({
        status: 'error',
        message: 'Payment type and token are required',
      });
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await supabase
        .from('saved_payment_methods')
        .update({ is_default: false })
        .eq('user_id', req.user.id);
    }

    // Insert new payment method
    const { data: paymentMethod, error } = await supabase
      .from('saved_payment_methods')
      .insert([{
        user_id: req.user.id,
        payment_type: paymentType,
        token,
        last_four: lastFour,
        card_brand: cardBrand,
        expiry_month: expiryMonth,
        expiry_year: expiryYear,
        is_default: isDefault || false,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error adding payment method:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to add payment method',
      });
    }

    res.status(201).json({
      status: 'success',
      data: { paymentMethod },
      message: 'Payment method added successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete payment method
// @route   DELETE /api/users/payment-methods/:id
// @access  Private
export const deletePaymentMethod = async (req, res, next) => {
  try {
    const supabase = getSupabase();
    const { id } = req.params;

    // Verify ownership
    const { data: paymentMethod, error: fetchError } = await supabase
      .from('saved_payment_methods')
      .select('id, user_id')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (fetchError || !paymentMethod) {
      return res.status(404).json({
        status: 'error',
        message: 'Payment method not found',
      });
    }

    // Delete payment method
    const { error } = await supabase
      .from('saved_payment_methods')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to delete payment method',
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Payment method deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

