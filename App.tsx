import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
    NavigationContainer,
} from "@react-navigation/native";

import {
    createNativeStackNavigator,
} from "@react-navigation/native-stack";

import SetupScreen from "./src/screens/SetupScreen";
import LoginScreen from "./src/screens/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";
import MembersScreen from "./src/screens/MembersScreen";
import AddMemberScreen from "./src/screens/AddMemberScreen";
import EditMemberScreen from "./src/screens/EditMemberScreen";

type RootStackParamList = {
    Home: undefined;
    Members: undefined;
    AddMember: undefined;
    EditMember: {
        memberId: string;
    };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

type AppScreen = "loading" | "setup" | "login" | "app";

export default function App() {
    const [screen, setScreen] = useState<AppScreen>("loading");

    useEffect(() => {
        checkSetup();
    }, []);

    const checkSetup = async () => {
        try {
            const setupData = await AsyncStorage.getItem("mandal_setup");

            if (setupData) {
                setScreen("login");
            } else {
                setScreen("setup");
            }
        } catch (error) {
            console.error("Setup check error:", error);
            setScreen("setup");
        }
    };

    if (screen === "loading") {
        return (
            <View
                style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                }}
            >
                <ActivityIndicator size="large" />
            </View>
        );
    }

    if (screen === "setup") {
        return (
            <SetupScreen
                onSetupComplete={() => setScreen("login")}
            />
        );
    }

    if (screen === "login") {
        return (
            <LoginScreen
                onLoginSuccess={() => setScreen("app")}
            />
        );
    }

    return (
        <NavigationContainer>
            <Stack.Navigator
                initialRouteName="Home"
                screenOptions={{
                    headerShown: false,
                }}
            >
                <Stack.Screen name="Home">
                    {() => <HomeScreen />}
                </Stack.Screen>

                <Stack.Screen name="Members">
                    {() => <MembersScreen />}
                </Stack.Screen>

                <Stack.Screen name="AddMember">
                    {() => <AddMemberScreen />}
                </Stack.Screen>

                <Stack.Screen name="EditMember">
                    {() => <EditMemberScreen />}
                </Stack.Screen>

            </Stack.Navigator>
        </NavigationContainer>
    );
}