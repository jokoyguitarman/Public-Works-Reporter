import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
// Import will be done dynamically to avoid Metro bundler issues
import GeoJSONLayer from '../components/GeoJSONLayer';

interface ReportMarker {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'resolved';
  type: 'pothole' | 'streetlight' | 'traffic' | 'other';
}

const MapScreen: React.FC = () => {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [region, setRegion] = useState<Region>({
    latitude: 12.8797, // Center of Philippines
    longitude: 121.7740,
    latitudeDelta: 8.0, // Wider view to see entire Philippines
    longitudeDelta: 8.0,
  });
  const [reports, setReports] = useState<ReportMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [geoJsonData, setGeoJsonData] = useState<any[]>([]);
  const [allGeoJsonData, setAllGeoJsonData] = useState<any[]>([]); // Store complete dataset
  const [infrastructureType, setInfrastructureType] = useState<'bridges' | 'highways' | 'kilometer-posts'>('bridges'); // Default to bridges

  useEffect(() => {
    getCurrentLocation();
    // Load mock reports for demonstration
    loadMockReports();
    // Load GeoJSON data
    loadGeoJSONData();
  }, []);

  // Reload data when infrastructure type changes
  useEffect(() => {
    loadGeoJSONData();
  }, [infrastructureType]);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Location permission is required to show your current position on the map.'
        );
        setLoading(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
      setRegion({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
      
      // Update nearby features when location is obtained
      if (allGeoJsonData.length > 0) {
        updateNearbyFeatures(currentLocation.coords.latitude, currentLocation.coords.longitude);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Unable to get your current location');
      setLoading(false);
    }
  };

  const loadMockReports = () => {
    // Mock data for demonstration
    const mockReports: ReportMarker[] = [
      {
        id: '1',
        latitude: 37.78825,
        longitude: -122.4324,
        title: 'Pothole on Main Street',
        description: 'Large pothole causing traffic issues',
        status: 'pending',
        type: 'pothole',
      },
      {
        id: '2',
        latitude: 37.78925,
        longitude: -122.4334,
        title: 'Broken Streetlight',
        description: 'Streetlight not working at night',
        status: 'in_progress',
        type: 'streetlight',
      },
    ];
    setReports(mockReports);
  };

  const loadGeoJSONData = async () => {
    try {
      console.log(`🔄 Loading ${infrastructureType} data from Supabase...`);
      console.log('🔧 Environment check:', {
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      });
      
      // Create supabase client using require to avoid Metro bundler issues
      const { createClient } = require('@supabase/supabase-js');
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Missing Supabase environment variables');
        setAllGeoJsonData([]);
        setGeoJsonData([]);
        return;
      }
      
      console.log('🔗 Connecting to Supabase:', supabaseUrl.substring(0, 30) + '...');
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Map infrastructure type to project type
      let projectType: string;
      if (infrastructureType === 'bridges') {
        projectType = 'bridge';
      } else if (infrastructureType === 'highways') {
        projectType = 'road';
      } else {
        projectType = 'other'; // kilometer posts
      }
      
      // Query projects from Supabase with spatial data
      console.log(`🔍 Querying projects with type: "${projectType}"`);
      const { data: projects, error } = await supabase
        .from('projects')
        .select('project_id, name, type, city, barangay, geom, raw')
        .eq('type', projectType)
        .order('project_id') // Order to ensure we get diverse geographic distribution
        .limit(50000); // Very high limit to get ALL bridges from database
      
      console.log('🔍 Query result:', { 
        error: error, 
        dataLength: projects?.length,
        hasData: !!projects 
      });
      
      if (error) {
        console.error('❌ Supabase query error:', error);
        setAllGeoJsonData([]);
        setGeoJsonData([]);
        return;
      }
      
      if (!projects || projects.length === 0) {
        console.warn(`⚠️ No ${infrastructureType} found in database`);
        setAllGeoJsonData([]);
        setGeoJsonData([]);
        return;
      }
      
      console.log(`✅ Loaded ${projects.length} ${infrastructureType} from Supabase`);
      console.log('📋 Sample project data:', projects[0]); // Debug log
      
      // Convert Supabase data to GeoJSON format
      const geoJsonFeatures = (projects || [])
        .filter(project => project.geom) // Only include projects with geometry
        .map(project => {
          let geometry = project.geom;
          
          // Handle different geometry formats from PostGIS
          if (typeof geometry === 'string') {
            try {
              geometry = JSON.parse(geometry);
            } catch (e) {
              console.warn('Failed to parse geometry:', e);
              return null;
            }
          }
          
          return {
            type: 'Feature',
            geometry: geometry,
            properties: {
              project_id: project.project_id,
              name: project.name,
              type: project.type,
              city: project.city,
              barangay: project.barangay,
              ...project.raw // Include original properties
            }
          };
        })
        .filter(feature => feature !== null); // Remove invalid features
      
      console.log(`🗺️ Created ${geoJsonFeatures.length} GeoJSON features`);
      
      // Debug: Log sample geometry to see format
      if (geoJsonFeatures.length > 0) {
        console.log('🔍 Sample geometry:', JSON.stringify(geoJsonFeatures[0].geometry, null, 2));
        console.log('🔍 Sample properties:', geoJsonFeatures[0].properties);
      }
      
      const geoJsonData = [{
        type: 'FeatureCollection',
        features: geoJsonFeatures
      }];
      
      setAllGeoJsonData(geoJsonData);
      
      console.log('🗺️ DPWH INFRASTRUCTURE DATA LOADED FROM SUPABASE! 🎉');
      console.log(`📊 Total: ${geoJsonFeatures.length} features loaded`);
      
      // TEMPORARY: Show all data to check how many bridges are actually loading
      console.log('🚨 SHOWING ALL DATA - CHECK TOTAL BRIDGE COUNT');
      setGeoJsonData(geoJsonData);
      
      // Filter nearby features if user location is available
      // if (location) {
      //   updateNearbyFeatures(location.coords.latitude, location.coords.longitude);
      // } else {
      //   // If no location yet, show everything (will be filtered when location is obtained)
      //   setGeoJsonData(geoJsonData);
      // }
    } catch (error) {
      console.error('Error loading data from Supabase:', error);
      setGeoJsonData([]);
    }
  };

  // Update nearby features based on user location
  const updateNearbyFeatures = (userLat: number, userLon: number) => {
    if (!allGeoJsonData || allGeoJsonData.length === 0) {
      console.log('⚠️ No GeoJSON data available for filtering');
      return;
    }
    
    if (typeof userLat !== 'number' || typeof userLon !== 'number' || 
        isNaN(userLat) || isNaN(userLon)) {
      console.warn('⚠️ Invalid coordinates provided to updateNearbyFeatures');
      return;
    }
    
    console.log(`🔍 Filtering features within 10km of location: ${userLat.toFixed(4)}, ${userLon.toFixed(4)}`);
    
    try {
      const nearbyData = filterNearbyFeatures(allGeoJsonData, userLat, userLon, 10);
      const nearbyCount = nearbyData.reduce((sum, dataset) => sum + (dataset.features?.length || 0), 0);
      
      console.log(`📍 Found ${nearbyCount} features within 10km`);
      setGeoJsonData(nearbyData);
    } catch (error) {
      console.error('Error filtering nearby features:', error);
      setGeoJsonData([]);
    }
  };

  const getMarkerColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#e74c3c';
      case 'in_progress':
        return '#f39c12';
      case 'resolved':
        return '#2ecc71';
      default:
        return '#95a5a6';
    }
  };

  // Calculate distance between two coordinates in kilometers
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Filter features within 10km of user location
  const filterNearbyFeatures = (data: any[], userLat: number, userLon: number, radiusKm: number = 10) => {
    if (!data || !Array.isArray(data)) {
      console.warn('⚠️ Invalid data provided to filterNearbyFeatures');
      return [];
    }

    return data.map(dataset => {
      if (!dataset || !dataset.features || !Array.isArray(dataset.features)) {
        console.warn('⚠️ Invalid dataset in filterNearbyFeatures');
        return { type: 'FeatureCollection', features: [] };
      }

      return {
        ...dataset,
        features: dataset.features.filter((feature: any) => {
          if (!feature || !feature.geometry || !feature.geometry.coordinates) return false;
        
        let featureLat: number, featureLon: number;
        
        try {
          if (feature.geometry.type === 'Point') {
            if (!Array.isArray(feature.geometry.coordinates) || feature.geometry.coordinates.length < 2) return false;
            featureLat = feature.geometry.coordinates[1];
            featureLon = feature.geometry.coordinates[0];
          } else if (feature.geometry.type === 'LineString') {
            if (!Array.isArray(feature.geometry.coordinates) || feature.geometry.coordinates.length === 0) return false;
            if (!Array.isArray(feature.geometry.coordinates[0]) || feature.geometry.coordinates[0].length < 2) return false;
            // Use first coordinate of line
            featureLat = feature.geometry.coordinates[0][1];
            featureLon = feature.geometry.coordinates[0][0];
          } else if (feature.geometry.type === 'MultiLineString') {
            if (!Array.isArray(feature.geometry.coordinates) || feature.geometry.coordinates.length === 0) return false;
            if (!Array.isArray(feature.geometry.coordinates[0]) || feature.geometry.coordinates[0].length === 0) return false;
            if (!Array.isArray(feature.geometry.coordinates[0][0]) || feature.geometry.coordinates[0][0].length < 2) return false;
            // Use first coordinate of first line
            featureLat = feature.geometry.coordinates[0][0][1];
            featureLon = feature.geometry.coordinates[0][0][0];
          } else {
            return false;
          }
          
          // Validate coordinates are numbers
          if (typeof featureLat !== 'number' || typeof featureLon !== 'number' || 
              isNaN(featureLat) || isNaN(featureLon)) {
            return false;
          }
        } catch (error) {
          console.warn('⚠️ Error extracting coordinates from feature:', error);
          return false;
        }
        
        const distance = calculateDistance(userLat, userLon, featureLat, featureLon);
        return distance <= radiusKm;
        })
      };
    });
  };

  const handleMarkerPress = (report: ReportMarker) => {
    Alert.alert(
      report.title,
      `${report.description}\n\nStatus: ${report.status.replace('_', ' ').toUpperCase()}`,
      [{ text: 'OK' }]
    );
  };

  const handleFeaturePress = (feature: any) => {
    const props = feature.properties;
    
    if (props.BR_NAME) {
      // Bridge data with comprehensive details
      const details = [
        `🌉 Bridge: ${props.BR_NAME}`,
        `📍 Location: ${props.BRGY}, ${props.MUNICIPAL}, ${props.PROVINCE}`,
        `🛣️ Road: ${props.ROAD_NAME}`,
        `📏 Length: ${props.BR_LENGTH}m | Width: ${props.BR_WIDTH}m`,
        `🏗️ Type: ${props.BR_TYPE1} ${props.BR_TYPE2}`,
        `📅 Built: ${props.Actual_Year || props.YR_CONST}`,
        `⚡ Condition: ${props.CONDITION}`,
        `🚛 Load Limit: ${props.LOAD_LIMIT} tons`,
        `🚗 Lanes: ${props.NUM_LANES} | Spans: ${props.NUM_SPAN}`,
        `⚠️ Issues: ${props.REMARKS || 'None'}`,
        `🏢 DEO: ${props.DEO}`,
        `🆔 Bridge ID: ${props.BRIDGE_ID}`,
      ].join('\n');
      
      Alert.alert(`${props.BR_NAME}`, details, [{ text: 'OK' }]);
    } else if (props.KM_POST) {
      // Kilometer Post data
      const details = [
        `📍 Kilometer Post: ${props.KM_POST}`,
        `🛣️ Road: ${props.ROAD_NAME}`,
        `🏝️ Island: ${props.ISLAND}`,
        `🌏 Region: ${props.REGION}`,
        `📍 Province: ${props.PROVINCE}`,
        `🏢 DEO: ${props.DEO}`,
        `🗳️ District: ${props.CONG_DIST}`,
      ].join('\n');
      
      Alert.alert(`📏 ${props.KM_POST}`, details, [{ text: 'OK' }]);
    } else if (props.SITE_NAME) {
      // Highway data
      const details = [
        `🛣️ Route: ${props.SITE_NAME}`,
        `📏 Length: ${(props.Shape__Length / 1000).toFixed(1)}km`,
        `🔢 Route Number: ${props.ROUTE_NO || 'N/A'}`,
        `🌏 Region: ${props.SUPER_REGI || 'N/A'}`,
        `🚢 Type: ${props.NAUTICAL || 'Highway'} Route`,
        `🏝️ Island Group: ${props.ISLAND || 'N/A'}`,
      ].join('\n');
      
      Alert.alert(`${props.SITE_NAME}`, details, [{ text: 'OK' }]);
    } else {
      // Generic feature
      Alert.alert(
        'Infrastructure Feature',
        `Type: ${feature.geometry.type}\nClick for more details`,
        [{ text: 'OK' }]
      );
    }
  };

  const centerOnLocation = () => {
    if (location) {
      setRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
      // Update nearby features when centering on location
      updateNearbyFeatures(location.coords.latitude, location.coords.longitude);
    }
  };

  // Handle map region changes to update nearby features
  const handleRegionChange = (newRegion: Region) => {
    setRegion(newRegion);
    // Update nearby features based on map center
    updateNearbyFeatures(newRegion.latitude, newRegion.longitude);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Public Works Map</Text>
        <Text style={styles.subtitle}>View reported issues in your area</Text>
      </View>

      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, infrastructureType === 'bridges' && styles.filterButtonActive]}
          onPress={() => setInfrastructureType('bridges')}
        >
          <Ionicons name="git-branch" size={20} color={infrastructureType === 'bridges' ? '#fff' : '#3498db'} />
          <Text style={[styles.filterButtonText, infrastructureType === 'bridges' && styles.filterButtonTextActive]}>Bridges</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, infrastructureType === 'highways' && styles.filterButtonActive]}
          onPress={() => setInfrastructureType('highways')}
        >
          <Ionicons name="car" size={20} color={infrastructureType === 'highways' ? '#fff' : '#3498db'} />
          <Text style={[styles.filterButtonText, infrastructureType === 'highways' && styles.filterButtonTextActive]}>Highways</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, infrastructureType === 'kilometer-posts' && styles.filterButtonActive]}
          onPress={() => setInfrastructureType('kilometer-posts')}
        >
          <Ionicons name="locate" size={20} color={infrastructureType === 'kilometer-posts' ? '#fff' : '#3498db'} />
          <Text style={[styles.filterButtonText, infrastructureType === 'kilometer-posts' && styles.filterButtonTextActive]}>KM Posts</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          region={region}
          onRegionChangeComplete={handleRegionChange}
          showsUserLocation={true}
          showsMyLocationButton={false}
        >
          {/* Mock reports */}
          {reports.map((report) => (
            <Marker
              key={report.id}
              coordinate={{
                latitude: report.latitude,
                longitude: report.longitude,
              }}
              title={report.title}
              description={report.description}
              pinColor={getMarkerColor(report.status)}
              onPress={() => handleMarkerPress(report)}
            />
          ))}
          
          {/* DPWH Infrastructure Data */}
          {geoJsonData && Array.isArray(geoJsonData) && geoJsonData.map((data, index) => (
                 <GeoJSONLayer
                   key={`geojson-${index}`}
                   data={data}
                   strokeColor={
                     index === 0 ? '#FF6B6B' :  // Red - Highway Layer 0
                     index === 1 ? '#4ECDC4' :  // Teal - Highway Layer 1
                     index === 2 ? '#9B59B6' :  // Purple - Highway Layer 2
                     index === 3 ? '#E67E22' :  // Orange - Highway Layer 3
                     index === 4 ? '#2ECC71' :  // Green - Complete Bridge Inventory
                     '#F1C40F'                  // Yellow - Complete Kilometer Posts
                   }
                   strokeWidth={index === 5 ? 3 : 2} // Thicker for kilometer posts
                   onFeaturePress={handleFeaturePress}
                 />
               ))}
        </MapView>

        {/* Location Button */}
        <TouchableOpacity
          style={styles.locationButton}
          onPress={centerOnLocation}
        >
          <Ionicons name="locate" size={24} color="#3498db" />
        </TouchableOpacity>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Status Legend</Text>
        <View style={styles.legendItems}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#e74c3c' }]} />
            <Text style={styles.legendText}>Pending</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#f39c12' }]} />
            <Text style={styles.legendText}>In Progress</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#2ecc71' }]} />
            <Text style={styles.legendText}>Resolved</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  locationButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: '#fff',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  legend: {
    backgroundColor: '#fff',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#e1e8ed',
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 10,
  },
  legendItems: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 5,
  },
  legendText: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 15,
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3498db',
    backgroundColor: '#fff',
  },
  filterButtonActive: {
    backgroundColor: '#3498db',
  },
  filterButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#3498db',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
});

export default MapScreen;

