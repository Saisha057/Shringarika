// Database Backup & Recovery Utilities

export interface BackupConfig {
  supabaseUrl: string;
  supabaseKey: string;
  tables: string[];
}

export interface BackupData {
  timestamp: string;
  tables: Record<string, any[]>;
  metadata: {
    version: string;
    recordCount: number;
  };
}

// Export data from Supabase tables
export const exportData = async (config: BackupConfig): Promise<BackupData> => {
  const backupData: BackupData = {
    timestamp: new Date().toISOString(),
    tables: {},
    metadata: {
      version: '1.0',
      recordCount: 0,
    },
  };

  // Note: This requires Supabase client - implement when connecting to backend
  // For now, export from localStorage
  const tables = ['users', 'products', 'orders', 'wishlist', 'cart'];
  
  tables.forEach((table) => {
    const data = localStorage.getItem(`fashion${table.charAt(0).toUpperCase() + table.slice(1)}`);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        backupData.tables[table] = Array.isArray(parsed) ? parsed : [parsed];
        backupData.metadata.recordCount += backupData.tables[table].length;
      } catch (error) {
        console.error(`Error parsing ${table}:`, error);
      }
    }
  });

  return backupData;
};

// Download backup as JSON file
export const downloadBackup = async (): Promise<void> => {
  try {
    const config: BackupConfig = {
      supabaseUrl: '',
      supabaseKey: '',
      tables: ['users', 'products', 'orders'],
    };

    const backup = await exportData(config);
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: 'application/json',
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `shringarika-backup-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log('Backup downloaded successfully');
  } catch (error) {
    console.error('Backup failed:', error);
    throw error;
  }
};

// Restore data from backup file
export const restoreFromBackup = async (file: File): Promise<void> => {
  try {
    const text = await file.text();
    const backup: BackupData = JSON.parse(text);
    
    // Validate backup structure
    if (!backup.timestamp || !backup.tables) {
      throw new Error('Invalid backup file format');
    }
    
    // Restore to localStorage
    Object.entries(backup.tables).forEach(([table, data]) => {
      const key = `fashion${table.charAt(0).toUpperCase() + table.slice(1)}`;
      localStorage.setItem(key, JSON.stringify(data));
    });
    
    console.log('Data restored successfully');
    alert(`Backup restored successfully!\nRecords: ${backup.metadata.recordCount}\nDate: ${new Date(backup.timestamp).toLocaleString()}`);
  } catch (error) {
    console.error('Restore failed:', error);
    throw error;
  }
};

// Schedule automatic backups (mock implementation)
export const scheduleAutomaticBackup = (intervalHours: number = 24): void => {
  const intervalMs = intervalHours * 60 * 60 * 1000;
  
  setInterval(async () => {
    try {
      await downloadBackup();
      console.log('Automatic backup completed');
    } catch (error) {
      console.error('Automatic backup failed:', error);
    }
  }, intervalMs);
  
  console.log(`Automatic backups scheduled every ${intervalHours} hours`);
};

// Get backup status
export const getBackupStatus = (): {
  lastBackup: string | null;
  totalRecords: number;
  size: string;
} => {
  let totalRecords = 0;
  let totalSize = 0;
  
  const tables = ['Users', 'Products', 'Orders', 'Wishlist', 'Cart'];
  tables.forEach((table) => {
    const data = localStorage.getItem(`fashion${table}`);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        const count = Array.isArray(parsed) ? parsed.length : 1;
        totalRecords += count;
        totalSize += new Blob([data]).size;
      } catch (error) {
        // Ignore parse errors
      }
    }
  });
  
  const lastBackup = localStorage.getItem('lastBackupTime');
  const sizeKB = (totalSize / 1024).toFixed(2);
  
  return {
    lastBackup,
    totalRecords,
    size: `${sizeKB} KB`,
  };
};

// Clear all data (with confirmation)
export const clearAllData = (confirmationCode: string): boolean => {
  if (confirmationCode !== 'DELETE_ALL_DATA') {
    return false;
  }
  
  const tables = ['Users', 'Products', 'Orders', 'Wishlist', 'Cart'];
  tables.forEach((table) => {
    localStorage.removeItem(`fashion${table}`);
  });
  
  console.log('All data cleared');
  return true;
};

// Export user data (GDPR compliance)
export const exportUserData = async (userId: string): Promise<void> => {
  const userData: any = {
    userId,
    exportDate: new Date().toISOString(),
    orders: [],
    wishlist: [],
    profile: null,
  };
  
  // Collect user data from localStorage
  const orders = localStorage.getItem('fashionOrders');
  if (orders) {
    userData.orders = JSON.parse(orders);
  }
  
  const wishlist = localStorage.getItem('fashionWishlist');
  if (wishlist) {
    userData.wishlist = JSON.parse(wishlist);
  }
  
  const user = localStorage.getItem('user');
  if (user) {
    userData.profile = JSON.parse(user);
  }
  
  // Download as JSON
  const blob = new Blob([JSON.stringify(userData, null, 2)], {
    type: 'application/json',
  });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `user-data-${userId}-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
