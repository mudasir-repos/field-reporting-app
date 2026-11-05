import { PermissionsAndroid, Platform } from 'react-native';

export async function requestCameraPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      {
        title: 'Camera Permission',
        message: 'This app needs camera access to capture report photos.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );

    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (error) {
    console.warn('Camera permission error:', error);
    return false;
  }
}
