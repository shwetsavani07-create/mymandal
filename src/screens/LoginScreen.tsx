import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Props = {
    onLoginSuccess: () => void;
};

export default function LoginScreen({ onLoginSuccess }: Props) {
    const [pin, setPin] = useState("");

    const handleLogin = async () => {
        if (pin.length !== 4) {
            Alert.alert("Invalid PIN", "Please enter your 4-digit PIN.");
            return;
        }

        try {
            const storedSetup = await AsyncStorage.getItem("mandal_setup");

            if (!storedSetup) {
                Alert.alert("Error", "Setup data not found.");
                return;
            }

            const setupData = JSON.parse(storedSetup);

            if (pin === setupData.pin) {
                setPin("");
                onLoginSuccess();
            } else {
                setPin("");
                Alert.alert("Incorrect PIN", "Please enter the correct PIN.");
            }
        } catch (error) {
            console.error("Login error:", error);
            Alert.alert("Error", "Something went wrong while checking the PIN.");
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>My Mandal</Text>

            <Text style={styles.subtitle}>Enter your 4-digit PIN</Text>

            <TextInput
                style={styles.pinInput}
                value={pin}
                onChangeText={setPin}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
                placeholder="••••"
                textAlign="center"
            />

            <TouchableOpacity style={styles.button} onPress={handleLogin}>
                <Text style={styles.buttonText}>Unlock</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        paddingHorizontal: 24,
    },

    title: {
        fontSize: 32,
        fontWeight: "700",
        textAlign: "center",
        marginBottom: 10,
    },

    subtitle: {
        fontSize: 16,
        textAlign: "center",
        marginBottom: 24,
    },

    pinInput: {
        alignSelf: "center",
        width: 180,
        height: 55,
        borderWidth: 1,
        borderColor: "#999",
        borderRadius: 10,
        fontSize: 24,
        marginBottom: 20,
    },

    button: {
        height: 50,
        borderRadius: 10,
        backgroundColor: "#2563EB",
        justifyContent: "center",
        alignItems: "center",
    },

    buttonText: {
        color: "#FFFFFF",
        fontSize: 17,
        fontWeight: "600",
    },
});
