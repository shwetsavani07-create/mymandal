import React, { useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";

import {
    getMembers,
    updateMember,
} from "../database/memberStorage";

type RootStackParamList = {
    Home: undefined;
    Members: undefined;
    AddMember: undefined;
    EditMember: {
        memberId: string;
    };
};

type EditMemberNavigationProp =
    NativeStackNavigationProp<RootStackParamList, "EditMember">;

type EditMemberRouteProp =
    RouteProp<RootStackParamList, "EditMember">;

export default function EditMemberScreen() {
    const navigation =
        useNavigation<EditMemberNavigationProp>();

    const route =
        useRoute<EditMemberRouteProp>();

    const { memberId } = route.params;

    const [name, setName] = useState("");
    const [mobile, setMobile] = useState("");
    const [monthlyInstallment, setMonthlyInstallment] =
        useState("");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    React.useEffect(() => {
        loadMember();
    }, []);

    const loadMember = async () => {
        try {
            const members = await getMembers();

            const member = members.find(
                (item) => item.id === memberId
            );

            if (!member) {
                Alert.alert(
                    "Member Not Found",
                    "This member could not be found.",
                    [
                        {
                            text: "OK",
                            onPress: () => navigation.goBack(),
                        },
                    ]
                );

                return;
            }

            setName(member.name);
            setMobile(member.mobile);
            setMonthlyInstallment(
                String(member.monthlyInstallment)
            );
        } catch (error) {
            console.error("Load member error:", error);

            Alert.alert(
                "Error",
                "Unable to load member details."
            );
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        const trimmedName = name.trim();
        const trimmedMobile = mobile.trim();
        const trimmedInstallment =
            monthlyInstallment.trim();

        if (!trimmedName) {
            Alert.alert(
                "Required",
                "Please enter member name."
            );
            return;
        }

        if (!trimmedMobile) {
            Alert.alert(
                "Required",
                "Please enter mobile number."
            );
            return;
        }

        if (!trimmedInstallment) {
            Alert.alert(
                "Required",
                "Please enter monthly installment."
            );
            return;
        }

        const installment = Number(trimmedInstallment);

        if (
            !Number.isFinite(installment) ||
            installment <= 0
        ) {
            Alert.alert(
                "Invalid Amount",
                "Please enter a valid monthly installment."
            );
            return;
        }

        try {
            setSaving(true);

            await updateMember(memberId, {
                name: trimmedName,
                mobile: trimmedMobile,
                monthlyInstallment: installment,
            });

            Alert.alert(
                "Member Updated",
                `${trimmedName} has been updated successfully.`,
                [
                    {
                        text: "OK",
                        onPress: () => navigation.goBack(),
                    },
                ]
            );
        } catch (error) {
            console.error(
                "Update member error:",
                error
            );

            Alert.alert(
                "Error",
                "Unable to update the member. Please try again."
            );
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>
                    Loading member...
                </Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={
                Platform.OS === "ios"
                    ? "padding"
                    : undefined
            }
        >
            <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={styles.title}>
                    Edit Member
                </Text>

                <Text style={styles.subtitle}>
                    Update the member details below.
                </Text>

                {/* Name */}
                <View style={styles.field}>
                    <Text style={styles.label}>
                        Name
                    </Text>

                    <TextInput
                        value={name}
                        onChangeText={setName}
                        placeholder="Enter member name"
                        placeholderTextColor="#9CA3AF"
                        style={styles.input}
                        autoCapitalize="words"
                    />
                </View>

                {/* Mobile */}
                <View style={styles.field}>
                    <Text style={styles.label}>
                        Mobile Number
                    </Text>

                    <TextInput
                        value={mobile}
                        onChangeText={setMobile}
                        placeholder="Enter mobile number"
                        placeholderTextColor="#9CA3AF"
                        style={styles.input}
                        keyboardType="phone-pad"
                    />
                </View>

                {/* Monthly Installment */}
                <View style={styles.field}>
                    <Text style={styles.label}>
                        Monthly Installment
                    </Text>

                    <TextInput
                        value={monthlyInstallment}
                        onChangeText={
                            setMonthlyInstallment
                        }
                        placeholder="Enter amount"
                        placeholderTextColor="#9CA3AF"
                        style={styles.input}
                        keyboardType="numeric"
                    />
                </View>

                <TouchableOpacity
                    style={[
                        styles.saveButton,
                        saving &&
                        styles.disabledButton,
                    ]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    <Text style={styles.saveButtonText}>
                        {saving
                            ? "Saving..."
                            : "Save Changes"}
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F7F8FA",
    },

    content: {
        padding: 20,
        paddingBottom: 40,
    },

    title: {
        fontSize: 28,
        fontWeight: "700",
        color: "#1F2937",
        marginTop: 20,
    },

    subtitle: {
        fontSize: 14,
        color: "#6B7280",
        marginTop: 6,
        marginBottom: 28,
    },

    field: {
        marginBottom: 20,
    },

    label: {
        fontSize: 15,
        fontWeight: "600",
        color: "#374151",
        marginBottom: 8,
    },

    input: {
        height: 52,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E5E7EB",
        borderRadius: 12,
        paddingHorizontal: 15,
        fontSize: 16,
        color: "#111827",
    },

    saveButton: {
        marginTop: 12,
        height: 54,
        backgroundColor: "#2563EB",
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
    },

    disabledButton: {
        opacity: 0.6,
    },

    saveButtonText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "700",
    },

    loadingContainer: {
        flex: 1,
        backgroundColor: "#F7F8FA",
        justifyContent: "center",
        alignItems: "center",
    },

    loadingText: {
        fontSize: 15,
        color: "#6B7280",
    },
});