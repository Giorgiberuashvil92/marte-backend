const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Removes all storage-related permissions from AndroidManifest.xml
 * These permissions are not needed when using Photo Picker API (Android 13+)
 * - READ_EXTERNAL_STORAGE
 * - WRITE_EXTERNAL_STORAGE
 * - READ_MEDIA_IMAGES
 * - READ_MEDIA_VIDEO
 * 
 * Uses withDangerousMod to run AFTER all other plugins have finished
 */
const withRemoveMediaPermissions = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const manifestPath = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'AndroidManifest.xml'
      );

      if (!fs.existsSync(manifestPath)) {
        console.warn('[withRemoveMediaPermissions] AndroidManifest.xml not found');
        return config;
      }

      // Read AndroidManifest.xml
      let manifestContent = fs.readFileSync(manifestPath, 'utf8');

      // List of permissions to remove
      const permissionsToRemove = [
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.READ_MEDIA_VIDEO',
      ];

      // Remove each permission
      let removedCount = 0;
      permissionsToRemove.forEach((permission) => {
        const escapedPermission = permission.replace(/\./g, '\\.');
        
        // Match the entire permission line including newline
        // Pattern: <uses-permission android:name="..." />
        const regex = new RegExp(
          `[\\s\\n]*<uses-permission[^>]*android:name="${escapedPermission}"[^>]*/>[\\s\\n]*`,
          'g'
        );
        
        const beforeLength = manifestContent.length;
        manifestContent = manifestContent.replace(regex, '');
        const afterLength = manifestContent.length;
        
        if (beforeLength !== afterLength) {
          removedCount++;
          console.log(`[withRemoveMediaPermissions] ✓ Removed: ${permission}`);
        }
      });
      
      if (removedCount > 0) {
        console.log(`[withRemoveMediaPermissions] Removed ${removedCount} permission(s)`);
      }

      // Write back to file
      fs.writeFileSync(manifestPath, manifestContent, 'utf8');

      return config;
    },
  ]);
};

module.exports = withRemoveMediaPermissions;
