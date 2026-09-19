import React from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

type RootStackParamList = {
    Home: undefined;
    Members: undefined;
    AddMember: undefined;
};

type HomeScreenNavigationProp =
    NativeStackNavigationProp<RootStackParamList, "Home">;

export default function HomeScreen() {
    const navigation = useNavigation<HomeScreenNavigationProp>();

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
        >
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>My Mandal</Text>
                    <Text style={styles.month}>September 2026</Text>
                </View>

                <TouchableOpacity style={styles.menuButton}>
                    <Text style={styles.menuText}>⋮</Text>
                </TouchableOpacity>
            </View>

            {/* Member Summary */}
            <View style={styles.memberRow}>
                <View style={styles.memberCard}>
                    <Text style={styles.cardLabel}>Members</Text>
                    <Text style={styles.cardValue}>20</Text>
                </View>

                <View style={styles.memberCard}>
                    <Text style={styles.cardLabel}>Paid</Text>
                    <Text style={styles.cardValue}>15</Text>
                </View>

                <View style={styles.memberCard}>
                    <Text style={styles.cardLabel}>Pending</Text>
                    <Text style={styles.cardValue}>5</Text>
                </View>
            </View>

            {/* Financial Summary */}
            <Text style={styles.sectionTitle}>This Month</Text>

            <View style={styles.financeCard}>
                <Text style={styles.financeLabel}>
                    Original Installments
                </Text>

                <Text style={styles.financeAmount}>
                    ₹10,000
                </Text>
            </View>

            <View style={styles.financeCard}>
                <Text style={styles.financeLabel}>
                    Current Amount Due
                </Text>

                <Text style={styles.financeAmount}>
                    ₹10,500
                </Text>
            </View>

            <View style={styles.financeCard}>
                <Text style={styles.financeLabel}>
                    Collected
                </Text>

                <Text style={styles.financeAmount}>
                    ₹8,500
                </Text>
            </View>

            <View style={styles.financeCard}>
                <Text style={styles.financeLabel}>
                    Pending
                </Text>

                <Text style={styles.financeAmount}>
                    ₹2,000
                </Text>
            </View>

            {/* Old Overdue */}
            <View style={styles.overdueSection}>
                <Text style={styles.overdueTitle}>
                    Old Overdue
                </Text>

                <Text style={styles.overdueAmount}>
                    ₹800
                </Text>

                <Text style={styles.overdueDescription}>
                    Outstanding from previous months
                </Text>
            </View>

            {/* Quick Actions */}
            <Text style={styles.sectionTitle}>Quick Actions</Text>

            <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionButton}>
                    <Text style={styles.actionText}>
                        Record Payment
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => navigation.navigate("AddMember")}
                >
                    <Text style={styles.actionText}>
                        Add Member
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Main Navigation */}
            <Text style={styles.sectionTitle}>Manage</Text>

            <TouchableOpacity style={styles.navigationButton}>
                <Text style={styles.navigationText}>
                    Monthly Payments
                </Text>
            </TouchableOpacity>

            {/* Members */}
            <TouchableOpacity
                style={styles.navigationButton}
                onPress={() => navigation.navigate("Members")}
            >
                <Text style={styles.navigationText}>
                    Members
                </Text>
            </TouchableOpacity>

            {/* History */}
            <TouchableOpacity style={styles.navigationButton}>
                <Text style={styles.navigationText}>
                    History
                </Text>
            </TouchableOpacity>
        </ScrollView>
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

    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 24,
    },

    title: {
        fontSize: 30,
        fontWeight: "700",
    },

    month: {
        fontSize: 16,
        color: "#666",
        marginTop: 4,
    },

    menuButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: "#FFFFFF",
        justifyContent: "center",
        alignItems: "center",
    },

    menuText: {
        fontSize: 28,
        lineHeight: 30,
    },

    memberRow: {
        flexDirection: "row",
        gap: 10,
        marginBottom: 28,
    },

    memberCard: {
        flex: 1,
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 14,
    },

    cardLabel: {
        fontSize: 13,
        color: "#666",
        marginBottom: 6,
    },

    cardValue: {
        fontSize: 24,
        fontWeight: "700",
    },

    sectionTitle: {
        fontSize: 20,
        fontWeight: "700",
        marginBottom: 12,
        marginTop: 8,
    },

    financeCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        padding: 18,
        marginBottom: 12,
    },

    financeLabel: {
        fontSize: 14,
        color: "#666",
        marginBottom: 6,
    },

    financeAmount: {
        fontSize: 24,
        fontWeight: "700",
    },

    overdueSection: {
        backgroundColor: "#FFF7ED",
        borderRadius: 14,
        padding: 18,
        marginTop: 10,
        marginBottom: 24,
    },

    overdueTitle: {
        fontSize: 18,
        fontWeight: "700",
    },

    overdueAmount: {
        fontSize: 24,
        fontWeight: "700",
        marginTop: 5,
    },

    overdueDescription: {
        fontSize: 14,
        color: "#666",
        marginTop: 4,
    },

    actionRow: {
        flexDirection: "row",
        gap: 12,
        marginBottom: 24,
    },

    actionButton: {
        flex: 1,
        backgroundColor: "#2563EB",
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: "center",
    },

    actionText: {
        color: "#FFFFFF",
        fontSize: 15,
        fontWeight: "600",
        textAlign: "center",
    },

    navigationButton: {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 18,
        marginBottom: 10,
    },

    navigationText: {
        fontSize: 16,
        fontWeight: "600",
    },
});