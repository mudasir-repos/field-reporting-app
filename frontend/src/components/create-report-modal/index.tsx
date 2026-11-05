import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  type Asset,
} from 'react-native-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from './styles';
import { CreateReportDraft } from '../../types';
import { compressImage } from '../../utils/compress-image';
import { requestCameraPermission } from '../../utils/camera-permission';

const MAX_IMAGES = 5;

interface CreateReportModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (report: CreateReportDraft) => void;
}

function CreateReportModal({
  visible,
  onClose,
  onSubmit,
}: CreateReportModalProps) {
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<Asset[]>([]);
  const [isPickingImages, setIsPickingImages] = useState(false);
  const [isCompressingImages, setIsCompressingImages] = useState(false);
  const [error, setError] = useState('');
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);

  const btnDisabled =
    images.length === 0 ||
    !description.trim() ||
    isPickingImages ||
    isCompressingImages;

  useEffect(() => {
    if (!visible) {
      setDescription('');
      setImages([]);
      setError('');
      setIsPickingImages(false);
    }
  }, [visible]);

  const handleSelectImages = async (source: 'camera' | 'gallery') => {
    const remainingSlots = MAX_IMAGES - images.length;

    if (remainingSlots <= 0) {
      setError(`You can select a maximum of ${MAX_IMAGES} images.`);
      return;
    }

    try {
      setIsPickingImages(true);
      setError('');

      const pickerOptions = {
        mediaType: 'photo' as const,
        quality: 1 as const,
      };

      if (source === 'camera') {
        const hasPermission = await requestCameraPermission();

        if (!hasPermission) {
          setError('Camera permission is required to capture photos.');
          return;
        }
      }

      const result =
        source === 'camera'
          ? await launchCamera({
              ...pickerOptions,
              saveToPhotos: false,
            })
          : await launchImageLibrary({
              ...pickerOptions,
              selectionLimit: remainingSlots,
            });

      if (result.didCancel) {
        return;
      }

      if (result.errorCode) {
        setError(result.errorMessage || 'Unable to select images.');
        return;
      }

      setIsPickingImages(false);
      const selectedImages = (result.assets ?? [])
        .filter(asset => Boolean(asset.uri))
        .slice(0, remainingSlots);

      selectedImages.forEach(image => {
        console.log(
          'Original image size:',
          image.fileSize
            ? `${(image.fileSize / (1024 * 1024)).toFixed(2)} MB`
            : 'Unknown',
        );
      });

      if (selectedImages.length === 0) {
        setError('No valid images were selected.');
        return;
      }

      const compressedImages: Asset[] = [];
      let failedCount = 0;
      setIsCompressingImages(true);

      try {
        for (const image of selectedImages) {
          try {
            const compressedImage = await compressImage(image);
            compressedImages.push(compressedImage);
          } catch (err) {
            failedCount++;
            console.warn('Image compression failed:', err);
          }
        }

        compressedImages.forEach(image => {
          console.log(
            'compressed image size:',
            image.fileSize
              ? `${(image.fileSize / (1024 * 1024)).toFixed(2)} MB`
              : 'Unknown',
          );
        });

        if (compressedImages.length > 0) {
          setImages(currentImages =>
            [...currentImages, ...compressedImages].slice(0, MAX_IMAGES),
          );
        }

        if (failedCount > 0) {
          setError(
            `${failedCount} image(s) could not be compressed. Please try another image.`,
          );
        }
      } finally {
        setIsCompressingImages(false);
      }
    } catch (e) {
      console.warn('Image selection failed:', e);
      setError('Something went wrong while selecting images.');
    } finally {
      setIsPickingImages(false);
    }
  };

  const handleRemoveImage = (uri: string) => {
    setImages(currentImages =>
      currentImages.filter(image => image.uri !== uri),
    );
  };

  const handleSubmit = () => {
    const trimmedDescription = description.trim();

    if (!trimmedDescription) {
      setError('Please enter a report description.');
      return;
    }

    if (images.length === 0) {
      setError('Please select at least one image.');
      return;
    }

    setError('');

    onSubmit({
      description: trimmedDescription,
      images,
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </Pressable>

            <Text style={styles.headerTitle}>Create Report</Text>

            <View style={styles.headerSpacer} />
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.helperText}>
              Describe the issue or situation you want to report.
            </Text>

            <TextInput
              value={description}
              onChangeText={value => {
                setDescription(value);
                setError('');
              }}
              placeholder="Enter report description..."
              placeholderTextColor="#9CA3AF"
              multiline
              textAlignVertical="top"
              maxLength={2000}
              style={styles.descriptionInput}
            />

            <Text style={styles.characterCount}>{description.length}/2000</Text>

            <View style={styles.imagePickerActions}>
              <Pressable
                onPress={() => handleSelectImages('camera')}
                disabled={isPickingImages || images.length >= MAX_IMAGES}
                style={styles.imageSourceButton}
              >
                <Text style={styles.imageSourceIcon}>📷</Text>
                <Text style={styles.imageSourceText}>Take Photo</Text>
              </Pressable>

              <Pressable
                onPress={() => handleSelectImages('gallery')}
                disabled={isPickingImages || images.length >= MAX_IMAGES}
                style={styles.imageSourceButton}
              >
                <Text style={styles.imageSourceIcon}>▧</Text>
                <Text style={styles.imageSourceText}>Choose from Gallery</Text>
              </Pressable>
            </View>

            {isPickingImages && (
              <View style={styles.processingContainer}>
                <ActivityIndicator color="#2563EB" />
                <Text style={styles.processingText}>
                  Waiting for image selection...
                </Text>
              </View>
            )}

            {isCompressingImages && (
              <View style={styles.processingContainer}>
                <ActivityIndicator color="#2563EB" />
                <Text style={styles.processingText}>
                  Optimizing images for upload...
                </Text>
              </View>
            )}

            {images.length > 0 && (
              <View style={styles.previewContainer}>
                {images.map((image, index) => (
                  <View key={image.uri ?? index} style={styles.previewItem}>
                    <Pressable
                      onPress={() => {
                        if (image.uri) {
                          setPreviewImageUri(image.uri);
                        }
                      }}
                    >
                      <Image
                        source={{ uri: image.uri }}
                        style={styles.previewImage}
                      />
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        if (image.uri) {
                          handleRemoveImage(image.uri);
                        }
                      }}
                      hitSlop={8}
                      style={styles.removeImageButton}
                    >
                      <Text style={styles.removeImageText}>×</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              onPress={handleSubmit}
              disabled={btnDisabled}
              style={[
                styles.submitButton,
                btnDisabled && styles.disabledButton,
              ]}
            >
              <Text style={styles.submitButtonText}>Continue</Text>
            </Pressable>
          </ScrollView>
          {previewImageUri && (
            <View style={styles.imagePreviewOverlay}>
              <Pressable
                style={styles.previewBackdrop}
                onPress={() => setPreviewImageUri(null)}
              />

              <Image
                source={{ uri: previewImageUri }}
                style={styles.fullPreviewImage}
                resizeMode="contain"
              />

              <Pressable
                onPress={() => setPreviewImageUri(null)}
                hitSlop={12}
                style={styles.previewCloseButton}
              >
                <Text style={styles.previewCloseText}>×</Text>
              </Pressable>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

export default CreateReportModal;
