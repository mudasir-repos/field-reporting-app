import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },

  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  closeButtonText: {
    fontSize: 30,
    lineHeight: 34,
    color: '#374151',
  },

  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },

  headerSpacer: {
    width: 36,
  },
  content: {
    padding: 20,
    paddingBottom: 36,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  helperText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 5,
    lineHeight: 19,
  },
  descriptionInput: {
    minHeight: 130,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
    fontSize: 15,
    color: '#111827',
  },
  characterCount: {
    textAlign: 'right',
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 6,
  },
  imageSectionHeader: {
    marginTop: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  imageCount: {
    fontSize: 13,
    color: '#6B7280',
  },
  imagePicker: {
    height: 110,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#93C5FD',
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    marginTop: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePickerIcon: {
    fontSize: 28,
    color: '#2563EB',
  },
  imagePickerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
    marginTop: 4,
  },
  previewContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 18,
  },
  previewItem: {
    width: '30%',
    aspectRatio: 1,
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
  },
  removeImageButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeImageText: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 22,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    marginTop: 16,
  },
  submitButton: {
    height: 50,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },

  imagePickerActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },

  imageSourceButton: {
    flex: 1,
    minHeight: 105,
    borderWidth: 1,
    borderColor: '#93C5FD',
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },

  imageSourceIcon: {
    fontSize: 28,
    marginBottom: 8,
  },

  imageSourceText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },

  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 16,
  },

  processingText: {
    fontSize: 13,
    color: '#6B7280',
  },
  imagePreviewOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    zIndex: 10,
    elevation: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  previewBackdrop: {
    ...StyleSheet.absoluteFill,
  },

  fullPreviewImage: {
    width: '100%',
    height: '100%',
  },

  previewCloseButton: {
    position: 'absolute',
    top: 16,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  previewCloseText: {
    color: '#FFFFFF',
    fontSize: 32,
    lineHeight: 36,
  },
});
