import React from 'react';
import { Polyline, Marker } from 'react-native-maps';

interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'LineString' | 'Point' | 'Polygon';
    coordinates: number[][] | number[];
  };
  properties: {
    [key: string]: any;
  };
}

interface GeoJSONData {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

interface GeoJSONLayerProps {
  data: GeoJSONData;
  strokeColor?: string;
  strokeWidth?: number;
  onFeaturePress?: (feature: GeoJSONFeature) => void;
}

const GeoJSONLayer: React.FC<GeoJSONLayerProps> = ({
  data,
  strokeColor = '#2196F3',
  strokeWidth = 2,
  onFeaturePress,
}) => {
  if (!data || !data.features) {
    return null;
  }

  return (
    <>
      {data.features.map((feature, index) => {
        // Skip features with null or invalid geometry
        if (!feature || !feature.geometry || !feature.geometry.type) {
          return null;
        }

        if (feature.geometry.type === 'LineString') {
          // Skip if coordinates are invalid
          if (!feature.geometry.coordinates || !Array.isArray(feature.geometry.coordinates)) {
            return null;
          }
          
          // Convert coordinates to the format react-native-maps expects
          const coordinates = feature.geometry.coordinates
            .filter((coord: any) => coord && Array.isArray(coord) && coord.length >= 2)
            .map((coord: number[]) => ({
              latitude: coord[1],
              longitude: coord[0],
            }));

          // Skip if no valid coordinates
          if (coordinates.length === 0) {
            return null;
          }

          return (
            <Polyline
              key={`line-${index}`}
              coordinates={coordinates}
              strokeColor={strokeColor}
              strokeWidth={strokeWidth}
              onPress={() => onFeaturePress && onFeaturePress(feature)}
            />
          );
        }

        if (feature.geometry.type === 'MultiLineString') {
          // Handle MultiLineString geometry
          if (!feature.geometry.coordinates || !Array.isArray(feature.geometry.coordinates)) {
            return null;
          }

          return (
            <React.Fragment key={`multiline-container-${index}`}>
              {feature.geometry.coordinates.map((lineCoords: number[][], lineIndex: number) => {
                const coordinates = lineCoords
                  .filter((coord: any) => coord && Array.isArray(coord) && coord.length >= 2)
                  .map((coord: number[]) => ({
                    latitude: coord[1],
                    longitude: coord[0],
                  }));

                if (coordinates.length === 0) {
                  return null;
                }

                return (
                  <Polyline
                    key={`multiline-${index}-${lineIndex}`}
                    coordinates={coordinates}
                    strokeColor={strokeColor}
                    strokeWidth={strokeWidth}
                    onPress={() => onFeaturePress && onFeaturePress(feature)}
                  />
                );
              })}
            </React.Fragment>
          );
        }

        if (feature.geometry.type === 'Point') {
          // Skip if coordinates are invalid
          const coord = feature.geometry.coordinates as number[];
          if (!coord || !Array.isArray(coord) || coord.length < 2) {
            return null;
          }
          
          return (
            <Marker
              key={`point-${index}`}
              coordinate={{
                latitude: coord[1],
                longitude: coord[0],
              }}
              title={feature.properties.BR_NAME || feature.properties.name || 'Infrastructure'}
              description={feature.properties.ROAD_NAME || feature.properties.description || 'DPWH Infrastructure'}
              onPress={() => onFeaturePress && onFeaturePress(feature)}
            />
          );
        }

        // Handle Polygon if needed
        if (feature.geometry.type === 'Polygon') {
          // Skip if coordinates are invalid
          if (!feature.geometry.coordinates || !Array.isArray(feature.geometry.coordinates) || 
              !feature.geometry.coordinates[0] || !Array.isArray(feature.geometry.coordinates[0])) {
            return null;
          }
          
          // For polygons, we'll just show the outline
          const coordinates = feature.geometry.coordinates[0]
            .filter((coord: any) => coord && Array.isArray(coord) && coord.length >= 2)
            .map((coord: number[]) => ({
              latitude: coord[1],
              longitude: coord[0],
            }));

          // Skip if no valid coordinates
          if (coordinates.length === 0) {
            return null;
          }

          return (
            <Polyline
              key={`polygon-${index}`}
              coordinates={coordinates}
              strokeColor={strokeColor}
              strokeWidth={strokeWidth}
              fillColor={strokeColor + '20'} // Add transparency
              onPress={() => onFeaturePress && onFeaturePress(feature)}
            />
          );
        }

        return null;
      })}
    </>
  );
};

export default GeoJSONLayer;
