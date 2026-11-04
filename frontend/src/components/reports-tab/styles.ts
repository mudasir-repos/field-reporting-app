import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 15,
    gap: 10,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#2563EB',
    fontWeight: '700',
  },
  indicator: {
    position: 'absolute',
    bottom: -1,
    height: 3,
    width: '75%',
    backgroundColor: '#2563EB',
    borderRadius: 3,
  },
});