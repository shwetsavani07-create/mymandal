import React, {
    useCallback,
    useState,
} from "react";

import {
    ActivityIndicator,
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

import {
    useFocusEffect,
    useNavigation,
} from "@react-navigation/native";

import {
    NativeStackNavigationProp,
} from "@react-navigation/native-stack";

import {
    getMembers,
    Member,
} from "../database/memberStorage";

import {
    createMonthlyObligation,
    getMonthlyObligation,
    updateMonthlyObligation,
    MonthlyObligation,
} from "../database/monthlyObligationStorage";

import {
    addPayment,
    getPaymentsForObligation,
    getTotalPaidForObligation,
} from "../database/paymentStorage";

import {
    calculatePaymentAmount,
} from "../utils/paymentCalculator";

type RootStackParamList = {
    Home: undefined;

    Members: undefined;

    AddMember: undefined;

    EditMember: {
        memberId: string;
    };

    MonthlyPayments: undefined;

    PaymentDetails: {
        obligationId: string;
        memberName: string;
        originalInstallment: number;
    };
};

type MonthlyPaymentsNavigationProp =
    NativeStackNavigationProp<
        RootStackParamList,
        "MonthlyPayments"
    >;

type MemberPaymentRow = {
    member: Member;
    obligation: MonthlyObligation;
};

export default function MonthlyPaymentsScreen() {
    const navigation =
        useNavigation<MonthlyPaymentsNavigationProp>();

    const [rows, setRows] =
        useState<MemberPaymentRow[]>([]);

    const [loading, setLoading] =
        useState(true);

    const [selectedRow, setSelectedRow] =
        useState<MemberPaymentRow | null>(null);

    const [paymentAmount, setPaymentAmount] =
        useState("");

    const [paymentModalVisible, setPaymentModalVisible] =
        useState(false);

    const [currentDate] =
        useState(() => new Date());

    const year =
        currentDate.getFullYear();

    const month =
        currentDate.getMonth() + 1;

    const monthName =
        currentDate.toLocaleString(
            "en-US",
            {
                month: "long",
            }
        );

    /*
     * Rebuild the monthly obligation from the payment records.
     *
     * This is important for old records that were entered using today's
     * date by mistake. The payment's actual paidAt date is the source
     * used to calculate the month's due amount.
     *
     * For multiple partial payments, the latest actual payment date is
     * used as the month's current/final penalty reference. The penalty
     * is still calculated on the full original installment only once.
     */
    const reconcileMonthlyObligation = async (
        obligation: MonthlyObligation
    ): Promise<MonthlyObligation> => {
        const payments =
            await getPaymentsForObligation(
                obligation.id
            );

        if (payments.length === 0) {
            return obligation;
        }

        const sortedPayments =
            [...payments].sort(
                (a, b) =>
                    new Date(b.paidAt).getTime() -
                    new Date(a.paidAt).getTime()
            );

        const latestPayment =
            sortedPayments[0];

        const paymentDate =
            new Date(latestPayment.paidAt);

        const calculation =
            calculatePaymentAmount(
                obligation.originalInstallment,
                paymentDate
            );

        const totalPaid =
            payments.reduce(
                (total, payment) =>
                    total +
                    payment.actualCollectedAmount,
                0
            );

        const remainingAmount =
            Math.max(
                calculation.totalDue -
                totalPaid,
                0
            );

        const status =
            remainingAmount === 0
                ? "paid"
                : totalPaid > 0
                    ? "partially_paid"
                    : "pending";

        const needsUpdate =
            Math.abs(
                obligation.currentAmountDue -
                calculation.totalDue
            ) > 0.009 ||
            Math.abs(
                obligation.penalty -
                calculation.penalty
            ) > 0.009 ||
            Math.abs(
                obligation.paidAmount -
                totalPaid
            ) > 0.009 ||
            Math.abs(
                obligation.remainingAmount -
                remainingAmount
            ) > 0.009 ||
            obligation.status !== status;

        if (!needsUpdate) {
            return obligation;
        }

        await updateMonthlyObligation(
            obligation.id,
            {
                currentAmountDue:
                calculation.totalDue,

                penalty:
                calculation.penalty,

                paidAmount:
                totalPaid,

                remainingAmount:
                remainingAmount,

                status:
                status,
            }
        );

        return {
            ...obligation,
            currentAmountDue:
            calculation.totalDue,
            penalty:
            calculation.penalty,
            paidAmount:
            totalPaid,
            remainingAmount:
            remainingAmount,
            status,
            updatedAt:
                new Date().toISOString(),
        };
    };

    const loadMonthlyPayments =
        useCallback(async () => {
            try {
                setLoading(true);

                const members =
                    await getMembers();

                const activeMembers =
                    members.filter(
                        (member) =>
                            member.isActive
                    );

                const paymentRows:
                    MemberPaymentRow[] = [];

                for (
                    const member of activeMembers
                    ) {
                    let obligation =
                        await getMonthlyObligation(
                            member.id,
                            year,
                            month
                        );

                    if (!obligation) {
                        obligation =
                            await createMonthlyObligation(
                                member.id,
                                year,
                                month,
                                member.monthlyInstallment
                            );
                    }

                    /*
                     * Always reconcile an existing obligation against
                     * its real payment dates before displaying it.
                     *
                     * This repairs old data such as:
                     * installment ₹1000
                     * payment date 14th
                     * stored due ₹1200
                     *
                     * and changes it back to:
                     * due ₹1000 / penalty ₹0.
                     */
                    obligation =
                        await reconcileMonthlyObligation(
                            obligation
                        );

                    paymentRows.push({
                        member,
                        obligation,
                    });
                }

                setRows(paymentRows);
            } catch (error) {
                console.error(
                    "Load monthly payments error:",
                    error
                );

                Alert.alert(
                    "Error",
                    "Unable to load monthly payments."
                );
            } finally {
                setLoading(false);
            }
        }, [year, month]);

    useFocusEffect(
        useCallback(() => {
            loadMonthlyPayments();
        }, [loadMonthlyPayments])
    );

    const openPaymentDialog = async (
        row: MemberPaymentRow
    ) => {
        try {
            if (
                row.obligation.status === "paid"
            ) {
                Alert.alert(
                    "Already Paid",
                    "This month's payment is already fully paid."
                );

                return;
            }

            /*
             * IMPORTANT:
             * Use the obligation's already-calculated
             * amount instead of recalculating from
             * today's date.
             *
             * This preserves an edited payment date.
             */
            const totalDue =
                row.obligation.currentAmountDue;

            const paidAmount =
                await getTotalPaidForObligation(
                    row.obligation.id
                );

            const remainingAmount =
                Math.max(
                    totalDue - paidAmount,
                    0
                );

            if (remainingAmount <= 0) {
                await updateMonthlyObligation(
                    row.obligation.id,
                    {
                        currentAmountDue:
                        totalDue,

                        penalty:
                        row.obligation.penalty,

                        paidAmount:
                        totalDue,

                        remainingAmount: 0,

                        status: "paid",
                    }
                );

                await loadMonthlyPayments();

                return;
            }

            setSelectedRow(row);

            setPaymentAmount(
                remainingAmount.toFixed(2)
            );

            setPaymentModalVisible(true);
        } catch (error) {
            console.error(
                "Open payment dialog error:",
                error
            );

            Alert.alert(
                "Error",
                "Unable to prepare the payment."
            );
        }
    };

    const closePaymentDialog = () => {
        setPaymentModalVisible(false);
        setSelectedRow(null);
        setPaymentAmount("");
    };

    const confirmPayment = async () => {
        if (!selectedRow) {
            return;
        }

        const amount =
            Number(paymentAmount);

        if (
            !Number.isFinite(amount) ||
            amount <= 0
        ) {
            Alert.alert(
                "Invalid Amount",
                "Please enter a valid payment amount."
            );

            return;
        }

        try {
            const {
                member,
                obligation,
            } = selectedRow;

            /*
             * IMPORTANT:
             * Do NOT calculate penalty using today's date.
             *
             * The obligation already contains the
             * correct calculated amount, including
             * any edited payment-date calculation.
             */
            const totalDue =
                obligation.currentAmountDue;

            const alreadyPaid =
                await getTotalPaidForObligation(
                    obligation.id
                );

            const remainingBeforePayment =
                Math.max(
                    totalDue - alreadyPaid,
                    0
                );

            if (
                amount >
                remainingBeforePayment
            ) {
                Alert.alert(
                    "Amount Too High",
                    `Maximum amount that can be collected now is ₹${remainingBeforePayment.toFixed(
                        2
                    )}.`
                );

                return;
            }

            const newPaidAmount =
                alreadyPaid + amount;

            const newRemainingAmount =
                Math.max(
                    totalDue -
                    newPaidAmount,
                    0
                );

            const newStatus =
                newRemainingAmount === 0
                    ? "paid"
                    : "partially_paid";

            Alert.alert(
                "Confirm Payment",
                `Member: ${member.name}\n\n` +
                `Total due: ₹${totalDue.toFixed(
                    2
                )}\n` +
                `Already paid: ₹${alreadyPaid.toFixed(
                    2
                )}\n` +
                `This payment: ₹${amount.toFixed(
                    2
                )}\n` +
                `Remaining: ₹${newRemainingAmount.toFixed(
                    2
                )}`,
                [
                    {
                        text: "Cancel",
                        style: "cancel",
                    },
                    {
                        text: "Confirm",
                        onPress: async () => {
                            await savePayment(
                                selectedRow,
                                amount,
                                newPaidAmount,
                                newRemainingAmount,
                                newStatus
                            );
                        },
                    },
                ]
            );
        } catch (error) {
            console.error(
                "Confirm payment error:",
                error
            );

            Alert.alert(
                "Error",
                "Unable to process the payment."
            );
        }
    };


    const savePayment = async (
        row: MemberPaymentRow,
        amount: number,
        newPaidAmount: number,
        newRemainingAmount: number,
        newStatus:
            | "paid"
            | "partially_paid"
    ) => {
        try {
            await addPayment({
                obligationId:
                row.obligation.id,

                memberId:
                row.member.id,

                year:
                row.obligation.year,

                month:
                row.obligation.month,

                calculatedAmount:
                row.obligation.currentAmountDue,

                calculatedPenalty:
                row.obligation.penalty,

                actualCollectedAmount:
                amount,

                isManualOverride:
                    false,

                paidAt:
                    new Date().toISOString(),
            });

            await updateMonthlyObligation(
                row.obligation.id,
                {
                    currentAmountDue:
                    row.obligation.currentAmountDue,

                    penalty:
                    row.obligation.penalty,

                    paidAmount:
                    newPaidAmount,

                    remainingAmount:
                    newRemainingAmount,

                    status:
                    newStatus,
                }
            );

            closePaymentDialog();

            Alert.alert(
                "Payment Recorded",
                `₹${amount.toFixed(
                    2
                )} collected from ${row.member.name}.`,
                [
                    {
                        text: "OK",
                        onPress:
                        loadMonthlyPayments,
                    },
                ]
            );
        } catch (error) {
            console.error(
                "Save payment error:",
                error
            );

            Alert.alert(
                "Error",
                "Unable to save the payment."
            );
        }
    };

    const paidCount =
        rows.filter(
            (row) =>
                row.obligation.status ===
                "paid"
        ).length;

    const pendingCount =
        rows.filter(
            (row) =>
                row.obligation.status !==
                "paid"
        ).length;

    if (loading) {
        return (
            <View
                style={
                    styles.loadingContainer
                }
            >
                <ActivityIndicator
                    size="large"
                />

                <Text
                    style={
                        styles.loadingText
                    }
                >
                    Loading monthly payments...
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
                contentContainerStyle={
                    styles.scrollContent
                }
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() =>
                            navigation.goBack()
                        }
                    >
                        <Text
                            style={
                                styles.backText
                            }
                        >
                            ← Back
                        </Text>
                    </TouchableOpacity>

                    <Text
                        style={styles.title}
                    >
                        Monthly Payments
                    </Text>

                    <Text
                        style={
                            styles.monthText
                        }
                    >
                        {monthName} {year}
                    </Text>
                </View>

                <View
                    style={
                        styles.summaryContainer
                    }
                >
                    <View
                        style={
                            styles.summaryCard
                        }
                    >
                        <Text
                            style={
                                styles.summaryLabel
                            }
                        >
                            Members
                        </Text>

                        <Text
                            style={
                                styles.summaryValue
                            }
                        >
                            {rows.length}
                        </Text>
                    </View>

                    <View
                        style={
                            styles.summaryCard
                        }
                    >
                        <Text
                            style={
                                styles.summaryLabel
                            }
                        >
                            Paid
                        </Text>

                        <Text
                            style={
                                styles.summaryValue
                            }
                        >
                            {paidCount}
                        </Text>
                    </View>

                    <View
                        style={
                            styles.summaryCard
                        }
                    >
                        <Text
                            style={
                                styles.summaryLabel
                            }
                        >
                            Pending
                        </Text>

                        <Text
                            style={
                                styles.summaryValue
                            }
                        >
                            {pendingCount}
                        </Text>
                    </View>
                </View>

                {rows.length === 0 ? (
                    <View
                        style={
                            styles.emptyContainer
                        }
                    >
                        <Text
                            style={
                                styles.emptyTitle
                            }
                        >
                            No active members
                        </Text>

                        <Text
                            style={
                                styles.emptyText
                            }
                        >
                            Add an active member
                            to start monthly
                            payments.
                        </Text>
                    </View>
                ) : (
                    <View style={styles.list}>
                        {rows.map(
                            ({
                                 member,
                                 obligation,
                             }) => (
                                <View
                                    key={
                                        obligation.id
                                    }
                                    style={
                                        styles.memberCard
                                    }
                                >
                                    <View
                                        style={
                                            styles.memberInfo
                                        }
                                    >
                                        <Text
                                            style={
                                                styles.memberName
                                            }
                                        >
                                            {
                                                member.name
                                            }
                                        </Text>

                                        <Text
                                            style={
                                                styles.mobile
                                            }
                                        >
                                            {
                                                member.mobile
                                            }
                                        </Text>

                                        <Text
                                            style={
                                                styles.installment
                                            }
                                        >
                                            Installment:
                                            {" "}
                                            ₹
                                            {obligation.originalInstallment.toFixed(
                                                2
                                            )}
                                        </Text>

                                        <Text
                                            style={
                                                styles.dueText
                                            }
                                        >
                                            Due:
                                            {" "}
                                            ₹
                                            {obligation.currentAmountDue.toFixed(
                                                2
                                            )}
                                        </Text>

                                        <Text
                                            style={
                                                styles.paidText
                                            }
                                        >
                                            Paid:
                                            {" "}
                                            ₹
                                            {obligation.paidAmount.toFixed(
                                                2
                                            )}
                                        </Text>

                                        <Text
                                            style={
                                                styles.remainingText
                                            }
                                        >
                                            Remaining:
                                            {" "}
                                            ₹
                                            {obligation.remainingAmount.toFixed(
                                                2
                                            )}
                                        </Text>

                                        <Text
                                            style={
                                                styles.status
                                            }
                                        >
                                            {
                                                obligation.status ===
                                                "paid"
                                                    ? "Paid"
                                                    : obligation.status ===
                                                    "partially_paid"
                                                        ? "Partially Paid"
                                                        : "Pending"
                                            }
                                        </Text>

                                        <TouchableOpacity
                                            style={
                                                styles.detailsButton
                                            }
                                            onPress={() =>
                                                navigation.navigate(
                                                    "PaymentDetails",
                                                    {
                                                        obligationId:
                                                        obligation.id,

                                                        memberName:
                                                        member.name,

                                                        originalInstallment:
                                                        obligation.originalInstallment,
                                                    }
                                                )
                                            }
                                        >
                                            <Text
                                                style={
                                                    styles.detailsButtonText
                                                }
                                            >
                                                Payment
                                                Details
                                            </Text>
                                        </TouchableOpacity>
                                    </View>

                                    <TouchableOpacity
                                        style={
                                            obligation.status ===
                                            "paid"
                                                ? styles.paidButton
                                                : styles.doneButton
                                        }
                                        disabled={
                                            obligation.status ===
                                            "paid"
                                        }
                                        onPress={() =>
                                            openPaymentDialog(
                                                {
                                                    member,
                                                    obligation,
                                                }
                                            )
                                        }
                                    >
                                        <Text
                                            style={
                                                styles.doneButtonText
                                            }
                                        >
                                            {
                                                obligation.status ===
                                                "paid"
                                                    ? "PAID"
                                                    : "DONE"
                                            }
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )
                        )}
                    </View>
                )}

                {paymentModalVisible &&
                    selectedRow && (
                        <View
                            style={
                                styles.paymentPanel
                            }
                        >
                            <Text
                                style={
                                    styles.panelTitle
                                }
                            >
                                Record Payment
                            </Text>

                            <Text
                                style={
                                    styles.panelMember
                                }
                            >
                                {
                                    selectedRow
                                        .member
                                        .name
                                }
                            </Text>

                            <Text
                                style={
                                    styles.panelInfo
                                }
                            >
                                Total due: ₹
                                {selectedRow.obligation.currentAmountDue.toFixed(
                                    2
                                )}
                            </Text>

                            <Text
                                style={
                                    styles.panelInfo
                                }
                            >
                                Already paid: ₹
                                {selectedRow.obligation.paidAmount.toFixed(
                                    2
                                )}
                            </Text>

                            <Text
                                style={
                                    styles.inputLabel
                                }
                            >
                                Amount to collect
                            </Text>

                            <TextInput
                                style={
                                    styles.amountInput
                                }
                                value={
                                    paymentAmount
                                }
                                onChangeText={
                                    setPaymentAmount
                                }
                                keyboardType="decimal-pad"
                                placeholder="Enter amount"
                            />

                            <View
                                style={
                                    styles.panelButtons
                                }
                            >
                                <TouchableOpacity
                                    style={
                                        styles.cancelButton
                                    }
                                    onPress={
                                        closePaymentDialog
                                    }
                                >
                                    <Text
                                        style={
                                            styles.cancelButtonText
                                        }
                                    >
                                        Cancel
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={
                                        styles.confirmButton
                                    }
                                    onPress={
                                        confirmPayment
                                    }
                                >
                                    <Text
                                        style={
                                            styles.confirmButtonText
                                        }
                                    >
                                        Confirm
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F7F8FA",
    },

    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },

    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },

    loadingText: {
        marginTop: 10,
        fontSize: 15,
        color: "#666",
    },

    header: {
        marginBottom: 18,
    },

    backText: {
        fontSize: 16,
        marginBottom: 10,
    },

    title: {
        fontSize: 24,
        fontWeight: "700",
    },

    monthText: {
        marginTop: 4,
        fontSize: 16,
        color: "#666",
    },

    summaryContainer: {
        flexDirection: "row",
        gap: 10,
        marginBottom: 18,
    },

    summaryCard: {
        flex: 1,
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 14,
    },

    summaryLabel: {
        fontSize: 13,
        color: "#666",
    },

    summaryValue: {
        marginTop: 4,
        fontSize: 22,
        fontWeight: "700",
    },

    list: {
        gap: 12,
    },

    memberCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        padding: 16,
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
    },

    memberInfo: {
        flex: 1,
        paddingRight: 12,
    },

    memberName: {
        fontSize: 17,
        fontWeight: "700",
    },

    mobile: {
        marginTop: 3,
        fontSize: 14,
        color: "#666",
    },

    installment: {
        marginTop: 8,
        fontSize: 14,
        fontWeight: "600",
    },

    dueText: {
        marginTop: 5,
        fontSize: 14,
        fontWeight: "600",
    },

    paidText: {
        marginTop: 3,
        fontSize: 14,
    },

    remainingText: {
        marginTop: 3,
        fontSize: 14,
    },

    status: {
        marginTop: 5,
        fontSize: 13,
        color: "#777",
    },

    detailsButton: {
        marginTop: 12,
        alignSelf: "flex-start",
        backgroundColor: "#E9E9E9",
        paddingHorizontal: 12,
        paddingVertical: 9,
        borderRadius: 8,
    },

    detailsButtonText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#222",
    },

    doneButton: {
        backgroundColor: "#222",
        paddingHorizontal: 18,
        paddingVertical: 11,
        borderRadius: 9,
        marginTop: 2,
    },

    paidButton: {
        backgroundColor: "#777",
        paddingHorizontal: 18,
        paddingVertical: 11,
        borderRadius: 9,
        marginTop: 2,
    },

    doneButtonText: {
        color: "#FFFFFF",
        fontWeight: "700",
        fontSize: 13,
    },

    emptyContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingTop: 100,
    },

    emptyTitle: {
        fontSize: 20,
        fontWeight: "700",
    },

    emptyText: {
        marginTop: 8,
        textAlign: "center",
        color: "#666",
    },

    paymentPanel: {
        marginTop: 20,
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 18,
    },

    panelTitle: {
        fontSize: 20,
        fontWeight: "700",
    },

    panelMember: {
        marginTop: 5,
        fontSize: 16,
        fontWeight: "600",
    },

    panelInfo: {
        marginTop: 8,
        fontSize: 14,
        color: "#555",
    },

    inputLabel: {
        marginTop: 18,
        marginBottom: 7,
        fontSize: 14,
        fontWeight: "600",
    },

    amountInput: {
        borderWidth: 1,
        borderColor: "#D5D5D5",
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 17,
        backgroundColor: "#FAFAFA",
    },

    panelButtons: {
        flexDirection: "row",
        gap: 10,
        marginTop: 16,
    },

    cancelButton: {
        flex: 1,
        paddingVertical: 13,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#CCC",
        alignItems: "center",
    },

    cancelButtonText: {
        fontSize: 15,
        fontWeight: "600",
    },

    confirmButton: {
        flex: 1,
        paddingVertical: 13,
        borderRadius: 10,
        backgroundColor: "#222",
        alignItems: "center",
    },

    confirmButtonText: {
        color: "#FFFFFF",
        fontSize: 15,
        fontWeight: "700",
    },
});