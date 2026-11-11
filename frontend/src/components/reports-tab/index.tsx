import { Pressable, Text, View } from 'react-native';
import { styles } from './styles';
import { ReportsTab } from '../../types';

interface ReportsTabsProps {
  activeTab: ReportsTab;
  onTabChange: (tab: ReportsTab) => void;
}

function ReportsTabs({ activeTab, onTabChange }: ReportsTabsProps) {
  return (
    <View style={styles.container}>
      <Pressable
        style={styles.tab}
        onPress={() => onTabChange('queue')}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === 'queue' }}
      >
        <Text
          style={[
            styles.tabText,
            activeTab === 'queue' && styles.activeTabText,
          ]}
        >
          Upload Queue
        </Text>

        {activeTab === 'queue' && <View style={styles.indicator} />}
      </Pressable>

      <Pressable
        style={styles.tab}
        onPress={() => onTabChange('all')}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === 'all' }}
      >
        <Text
          style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}
        >
          All Reports
        </Text>

        {activeTab === 'all' && <View style={styles.indicator} />}
      </Pressable>
    </View>
  );
}

export default ReportsTabs;
