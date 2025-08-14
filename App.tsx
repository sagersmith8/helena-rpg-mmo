import React, { useState, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import GoblinIcon from "./assets/icons/monsters/goblin.svg";
import SwordInStone from "./assets/icons/weapons/sword-in-stone.svg";

type Goblin = {
  id: number;
  latitude: number;
  longitude: number;
  path: { lat: number; lng: number }[];
  step: number;
};

const generateCirclePoints = (lat: number, lng: number, radiusMeters: number, numPoints: number) => {
  const points = [];
  const R = 6378137; // Earth radius in meters
  const rad = radiusMeters / R;

  for (let i = 0; i < numPoints; i++) {
    const theta = (2 * Math.PI * i) / numPoints;
    const dLat = rad * Math.cos(theta);
    const dLng = rad * Math.sin(theta) / Math.cos((lat * Math.PI) / 180);

    points.push({
      lat: lat + (dLat * 180) / Math.PI,
      lng: lng + (dLng * 180) / Math.PI,
    });
  }

  return points;
};

export default function App() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [goblins, setGoblins] = useState<Goblin[]>([]);

  useEffect(() => {
      let intervalId: NodeJS.Timer;

      (async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          console.warn("Permission to access location was denied");
          return;
        }

        const loc = await Location.getCurrentPositionAsync({});
        setLocation(loc);

        const radius = 100; //1609; // ~1 miles in meters
        const circlePoints = generateCirclePoints(loc.coords.latitude, loc.coords.longitude, radius, 8); // 8 waypoints

        // Build OSRM request
        const waypointString = circlePoints.map(p => `${p.lng},${p.lat}`).join(";");
        const response = await fetch(
          `http://router.project-osrm.org/route/v1/driving/${waypointString}?overview=full&geometries=geojson`
        );
        const data = await response.json();

        if (!data.routes || data.routes.length === 0) {
          console.warn("Failed to fetch route");
          return;
        }

        const routeCoords = data.routes[0].geometry.coordinates.map(([lng, lat]: [number, number]) => ({
          lat,
          lng,
        }));

        // Spawn 3 goblins
        const goblinSpawns = [0, 1, 2].map(idx => ({
          id: idx,
          latitude: routeCoords[0].lat,
          longitude: routeCoords[0].lng,
          path: routeCoords,
          step: idx,
        }));

        setGoblins(goblinSpawns);

        const smoothStepInterval = 100; // ms per micro-step
        const microSteps = 20;          // number of interpolations per segment

        intervalId = setInterval(() => {
          setGoblins(prev =>
            prev.map(g => {
              const current = g.path[g.step];
              const nextStep = (g.step + 1) % g.path.length;
              const next = g.path[nextStep];

              // Use microStep to calculate the interpolation factor
              const interpolationFactor = (g.microStep ?? 0) / microSteps;

              // Interpolate latitude and longitude
              const microLat = current.lat + (next.lat - current.lat) * interpolationFactor;
              const microLng = current.lng + (next.lng - current.lng) * interpolationFactor;

              // Update microStep and step
              const newMicroStep = (g.microStep ?? 0) + 1;
              const newStep = newMicroStep >= microSteps ? nextStep : g.step;

              return {
                ...g,
                latitude: microLat,
                longitude: microLng,
                step: newStep,
                microStep: newMicroStep % microSteps,
              };
            })
          );
        }, smoothStepInterval);
      })();

      return () => {
        if (intervalId) clearInterval(intervalId);
      };
    }, []);

    if (!location) {
      return (
        <View style={styles.container}>
          <View style={{ alignItems: "center", justifyContent: "center", flex: 1 }}>
            <SwordInStone width={100} height={100} />
          </View>
        </View>
      );
    } else if (!goblins.length) {
        return (
            <View style={styles.container}>
                <View style={{ alignItems: "center", justifyContent: "center", flex: 1 }}>
                    <GoblinIcon width={100} height={100} />
                </View>
            </View>
        );
    }

  const { latitude, longitude } = location.coords;

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation={true}
        followsUserLocation={true}
      >
        {goblins.map(g => (
          <Marker key={g.id} coordinate={{ latitude: g.latitude, longitude: g.longitude }}>
            <View style={{ width: 20, height: 20 }}>
              <GoblinIcon width={20} height={20} />
            </View>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  map: { flex: 1 },
});
