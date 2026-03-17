import { supabase, supabaseAdmin } from '../config/supabase.js';
import bcrypt from 'bcryptjs';

// User model helper functions for Supabase
export const User = {
  async findByEmail(email) {
    const { data, error } = await supabase.from('users').select('*').eq('email', email).single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },
  async findById(id) {
    const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },
  async create(userData) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(userData.password, salt);
    const { data, error } = await supabaseAdmin.from('users').insert([{
      name: userData.name,
      email: userData.email,
      password: hashedPassword,
      phone: userData.phone || null,
      role: userData.role || 'user'
    }]).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, updates) {
    if (updates.password) {
      const salt = await bcrypt.genSalt(10);
      updates.password = await bcrypt.hash(updates.password, salt);
    }
    const { data, error } = await supabaseAdmin.from('users').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async comparePassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  },
  async findAll() {
    const { data, error } = await supabaseAdmin.from('users').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }
};
export default User;
