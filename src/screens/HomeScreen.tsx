import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

interface QuickActionProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  color: string;
}

const QuickAction: React.FC<QuickActionProps> = ({ icon, title, subtitle, onPress, color }) => (
  <TouchableOpacity style={styles.quickAction} onPress={onPress}>
    <View style={[styles.iconContainer, { backgroundColor: color }]}>
      <Ionicons name={icon} size={24} color="white" />
    </View>
    <View style={styles.actionText}>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionSubtitle}>{subtitle}</Text>
    </View>
    <Ionicons name="chevron-forward" size={20} color="#bdc3c7" />
  </TouchableOpacity>
);

const HomeScreen: React.FC = () => {
  const navigation = useNavigation();

  const handleReportIssue = () => {
    // Navigate to camera screen
    navigation.navigate('Camera' as never);
  };

  const handleViewMap = () => {
    // Navigate to map screen
    navigation.navigate('Map' as never);
  };

  const handleMyReports = () => {
    // Navigate to reports screen
    navigation.navigate('Reports' as never);
  };

  const handleEmergencyReport = () => {
    // Handle emergency reporting - go to camera for now
    navigation.navigate('Camera' as never);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.welcomeText}>Welcome to</Text>
          <Text style={styles.appTitle}>Public Works Reporter</Text>
          <Text style={styles.subtitle}>Help improve your community by reporting public works issues</Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <QuickAction
            icon="camera"
            title="Report an Issue"
            subtitle="Take a photo and report a problem"
            onPress={handleReportIssue}
            color="#e74c3c"
          />
          
          <QuickAction
            icon="map"
            title="View Map"
            subtitle="See reported issues in your area"
            onPress={handleViewMap}
            color="#3498db"
          />
          
          <QuickAction
            icon="list"
            title="My Reports"
            subtitle="Track your submitted reports"
            onPress={handleMyReports}
            color="#2ecc71"
          />
          
          <QuickAction
            icon="warning"
            title="Emergency Report"
            subtitle="Report urgent safety issues"
            onPress={handleEmergencyReport}
            color="#f39c12"
          />
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.activityContainer}>
            <Text style={styles.noActivityText}>No recent activity</Text>
            <Text style={styles.noActivitySubtext}>Your reported issues will appear here</Text>
          </View>
        </View>

        {/* Tips */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tips</Text>
          <View style={styles.tipContainer}>
            <Ionicons name="bulb-outline" size={20} color="#f39c12" />
            <Text style={styles.tipText}>
              Take clear photos and provide detailed descriptions for faster resolution
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  welcomeText: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 5,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    lineHeight: 22,
  },
  section: {
    backgroundColor: '#fff',
    marginBottom: 10,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 15,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  activityContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  noActivityText: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 5,
  },
  noActivitySubtext: {
    fontSize: 14,
    color: '#bdc3c7',
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef9e7',
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f39c12',
  },
  tipText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: '#7f8c8d',
    lineHeight: 20,
  },
});

export default HomeScreen;

