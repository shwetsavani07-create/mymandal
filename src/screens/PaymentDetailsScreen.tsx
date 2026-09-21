import React, {
    useCallback,
    useState,
} from "react";

import {
    Alert,
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
    useRoute,
} from "@react-navigation/native";

import {
    NativeStackNavigationProp,
    NativeStackScreenProps,
} from "@react-navigation/native-stack";

import {
    getPaymentsForObligation,
    Payment,
    updatePayment,
} from "../database/paymentStorage";

import {
    getMonthlyObligation,
    updateMonthlyObligation,
} from "../database/monthlyObligationStorage";

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

type PaymentDetailsRoute =
    NativeStackScreenProps<
        RootStackParamList,
        "PaymentDetails"
    >;

type NavigationProp =
    NativeStackNavigationProp<
        RootStackParamList,
        "PaymentDetails"
    >;

export default function PaymentDetailsScreen() {
    const navigation =
        useNavigation<NavigationProp>();

    const route =
        useRoute<PaymentDetailsRoute["route"]>();

    const {
        obligationId,
        memberName,
        originalInstallment,
    } = route.params;

    const [payments, setPayments] =
        useState<Payment[]>([]);

    const [loading, setLoading] =
        useState(true);

    const [editingPaymentId, setEditingPaymentId] =
        useState<string | null>(null);

    const [editDate, setEditDate] =
        useState("");

    const [editTime, setEditTime] =
        useState("");

    const loadPayments =
        useCallback(async () => {
            try {
                setLoading(true);

                const data =
                    await getPaymentsForObligation(
                        obligationId
                    );

                setPayments(data);
            } catch (error) {
                console.error(
                    "Load payments error:",
                    error
                );

                Alert.alert(
                    "Error",
                    "Unable to load payment records."
                );
            } finally {
                setLoading(false);
            }
        }, [obligationId]);

    useFocusEffect(
        useCallback(() => {
            loadPayments();
        }, [loadPayments])
    );

    const startEditing = (
        payment: Payment
    ) => {
        const date =
            new Date(payment.paidAt);

        const day = String(
            date.getDate()
        ).padStart(2, "0");

        const month = String(
            date.getMonth() + 1
        ).padStart(2, "0");

        const year =
            date.getFullYear();

        const hours = String(
            date.getHours()
        ).padStart(2, "0");

        const minutes = String(
            date.getMinutes()
        ).padStart(2, "0");

        setEditDate(
            `${day}/${month}/${year}`
        );

        setEditTime(
            `${hours}:${minutes}`
        );

        setEditingPaymentId(
            payment.id
        );
    };

    const cancelEditing = () => {
        setEditingPaymentId(null);
        setEditDate("");
        setEditTime("");
    };

    const parseDateTime = (): Date | null => {
        const dateParts =
            editDate.trim().split("/");

        const timeParts =
            editTime.trim().split(":");

        if (
            dateParts.length !== 3 ||
            timeParts.length !== 2
        ) {
            return null;
        }

        const day =
            Number(dateParts[0]);

        const month =
            Number(dateParts[1]);

        const year =
            Number(dateParts[2]);

        const hours =
            Number(timeParts[0]);

        const minutes =
            Number(timeParts[1]);

        if (
            !Number.isInteger(day) ||
            !Number.isInteger(month) ||
            !Number.isInteger(year) ||
            !Number.isInteger(hours) ||
            !Number.isInteger(minutes)
        ) {
            return null;
        }

        if (
            year < 2000 ||
            year > 2100 ||
            month < 1 ||
            month > 12 ||
            day < 1 ||
            day > 31 ||
            hours < 0 ||
            hours > 23 ||
            minutes < 0 ||
            minutes > 59
        ) {
            return null;
        }

        const date =
            new Date(
                year,
                month - 1,
                day,
                hours,
                minutes,
                0,
                0
            );

        // Prevent JavaScript from accepting invalid dates
        // such as 31/02/2026.
        if (
            date.getFullYear() !== year ||
            date.getMonth() !== month - 1 ||
            date.getDate() !== day ||
            date.getHours() !== hours ||
            date.getMinutes() !== minutes
        ) {
            return null;
        }

        return date;
    };

    /*
     * Recalculate the whole monthly obligation from the actual payment
     * records. We do not trust an old/stale calculatedAmount because
     * the record may have originally been entered using today's date.
     *
     * The latest actual payment date is the month's penalty reference.
     * The penalty is calculated once on the full original installment.
     */
    const recalculateObligation = async (
        updatedPayments: Payment[]
    ) => {
        if (updatedPayments.length === 0) {
            return;
        }

        const firstPayment =
            updatedPayments[0];

        const obligation =
            await getMonthlyObligation(
                obligationId,
                firstPayment.year,
                firstPayment.month
            );

        if (!obligation) {
            return;
        }

        const sortedPayments =
            [...updatedPayments].sort(
                (a, b) =>
                    new Date(b.paidAt).getTime() -
                    new Date(a.paidAt).getTime()
            );

        const latestPayment =
            sortedPayments[0];

        const latestPaymentDate =
            new Date(latestPayment.paidAt);

        const calculation =
            calculatePaymentAmount(
                obligation.originalInstallment,
                latestPaymentDate
            );

        const totalPaid =
            updatedPayments.reduce(
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
    };

    const saveEditedDate = async (
        payment: Payment
    ) => {
        const newDate =
            parseDateTime();

        if (!newDate) {
            Alert.alert(
                "Invalid Date",
                "Please enter a valid date and time.\n\nDate: DD/MM/YYYY\nTime: HH:MM"
            );

            return;
        }

        /*
         * IMPORTANT:
         *
         * The obligation month NEVER changes.
         * We only change the actual payment date/time.
         *
         * The penalty is calculated using the date selected
         * by the admin, NOT today's date.
         */
        const calculation =
            calculatePaymentAmount(
                originalInstallment,
                newDate
            );

        /*
         * This handles the exact situation where the payment
         * was previously entered incorrectly using today's date.
         *
         * Example:
         * Old calculated amount = ₹1,200
         * Old actual collected = ₹1,200
         * Correct date = 14th
         * Correct calculated amount = ₹1,000
         *
         * In that case the app automatically corrects the
         * actual collected amount to ₹1,000 too.
         *
         * If actualCollectedAmount is different from the old
         * calculated amount, we preserve it because that may
         * represent a genuine manual/partial collection.
         */
        const wasPreviouslyAutoCalculated =
            Math.abs(
                payment.actualCollectedAmount -
                payment.calculatedAmount
            ) < 0.01;

        const correctedCollectedAmount =
            wasPreviouslyAutoCalculated
                ? calculation.totalDue
                : payment.actualCollectedAmount;

        const oldDate =
            new Date(payment.paidAt);

        const oldDateText =
            oldDate.toLocaleDateString();

        const newDateText =
            newDate.toLocaleDateString();

        const collectedChangeText =
            wasPreviouslyAutoCalculated
                ? `\nCorrected collected amount: ₹${correctedCollectedAmount.toFixed(
                    2
                )}`
                : `\nActual collected amount remains: ₹${correctedCollectedAmount.toFixed(
                    2
                )}`;

        Alert.alert(
            "Confirm Date Change",
            `Member: ${memberName}\n\n` +
            `Old date: ${oldDateText}\n` +
            `New date: ${newDateText}\n\n` +
            `Original installment: ₹${originalInstallment.toFixed(
                2
            )}\n` +
            `New penalty: ₹${calculation.penalty.toFixed(
                2
            )}\n` +
            `New calculated amount: ₹${calculation.totalDue.toFixed(
                2
            )}` +
            collectedChangeText,
            [
                {
                    text: "Cancel",
                    style: "cancel",
                },
                {
                    text: "Confirm",
                    onPress: async () => {
                        try {
                            await updatePayment(
                                payment.id,
                                {
                                    paidAt:
                                        newDate.toISOString(),

                                    calculatedAmount:
                                    calculation.totalDue,

                                    calculatedPenalty:
                                    calculation.penalty,

                                    actualCollectedAmount:
                                    correctedCollectedAmount,

                                    /*
                                     * If the amount was automatically
                                     * corrected from the old calculated
                                     * amount, it is no longer a manual
                                     * override.
                                     */
                                    isManualOverride:
                                        wasPreviouslyAutoCalculated
                                            ? false
                                            : payment.isManualOverride,
                                }
                            );

                            const refreshedPayments =
                                await getPaymentsForObligation(
                                    obligationId
                                );

                            setPayments(
                                refreshedPayments
                            );

                            await recalculateObligation(
                                refreshedPayments
                            );

                            cancelEditing();

                            Alert.alert(
                                "Payment Updated",
                                `Payment date changed to ${newDateText}.\n\n` +
                                `Calculated amount: ₹${calculation.totalDue.toFixed(
                                    2
                                )}\n` +
                                `Penalty: ₹${calculation.penalty.toFixed(
                                    2
                                )}\n` +
                                `Collected: ₹${correctedCollectedAmount.toFixed(
                                    2
                                )}`,
                                [
                                    {
                                        text: "OK",
                                        onPress:
                                        loadPayments,
                                    },
                                ]
                            );
                        } catch (error) {
                            console.error(
                                "Update payment date error:",
                                error
                            );

                            Alert.alert(
                                "Error",
                                "Unable to update the payment date."
                            );
                        }
                    },
                },
            ]
        );
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <Text>
                    Loading payments...
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ScrollView
                contentContainerStyle={
                    styles.content
                }
            >
                <TouchableOpacity
                    onPress={() =>
                        navigation.goBack()
                    }
                >
                    <Text style={styles.back}>
                        ← Back
                    </Text>
                </TouchableOpacity>

                <Text style={styles.title}>
                    Payment Details
                </Text>

                <Text
                    style={styles.memberName}
                >
                    {memberName}
                </Text>

                <Text
                    style={styles.subtitle}
                >
                    Installment: ₹
                    {originalInstallment.toFixed(
                        2
                    )}
                </Text>

                {payments.length === 0 ? (
                    <View
                        style={
                            styles.emptyContainer
                        }
                    >
                        <Text>
                            No payments recorded.
                        </Text>
                    </View>
                ) : (
                    payments.map(
                        (
                            payment,
                            index
                        ) => {
                            const paidDate =
                                new Date(
                                    payment.paidAt
                                );

                            const isEditing =
                                editingPaymentId ===
                                payment.id;

                            return (
                                <View
                                    key={
                                        payment.id
                                    }
                                    style={
                                        styles.paymentCard
                                    }
                                >
                                    <Text
                                        style={
                                            styles.paymentNumber
                                        }
                                    >
                                        Payment #
                                        {index + 1}
                                    </Text>

                                    <Text
                                        style={
                                            styles.amount
                                        }
                                    >
                                        Collected: ₹
                                        {payment.actualCollectedAmount.toFixed(
                                            2
                                        )}
                                    </Text>

                                    <Text
                                        style={
                                            styles.info
                                        }
                                    >
                                        Date:{" "}
                                        {paidDate.toLocaleDateString()}
                                    </Text>

                                    <Text
                                        style={
                                            styles.info
                                        }
                                    >
                                        Time:{" "}
                                        {paidDate.toLocaleTimeString()}
                                    </Text>

                                    <Text
                                        style={
                                            styles.info
                                        }
                                    >
                                        Calculated
                                        amount: ₹
                                        {payment.calculatedAmount.toFixed(
                                            2
                                        )}
                                    </Text>

                                    <Text
                                        style={
                                            styles.info
                                        }
                                    >
                                        Calculated
                                        penalty: ₹
                                        {payment.calculatedPenalty.toFixed(
                                            2
                                        )}
                                    </Text>

                                    {payment.isManualOverride && (
                                        <Text
                                            style={
                                                styles.overrideInfo
                                            }
                                        >
                                            Manual override
                                            {payment.overrideReason
                                                ? `: ${payment.overrideReason}`
                                                : ""}
                                        </Text>
                                    )}

                                    {isEditing ? (
                                        <View
                                            style={
                                                styles.editBox
                                            }
                                        >
                                            <Text
                                                style={
                                                    styles.label
                                                }
                                            >
                                                Date
                                                {" "}
                                                (DD/MM/YYYY)
                                            </Text>

                                            <TextInput
                                                style={
                                                    styles.input
                                                }
                                                value={
                                                    editDate
                                                }
                                                onChangeText={
                                                    setEditDate
                                                }
                                                placeholder="14/09/2026"
                                                keyboardType="numbers-and-punctuation"
                                                maxLength={
                                                    10
                                                }
                                            />

                                            <Text
                                                style={
                                                    styles.label
                                                }
                                            >
                                                Time
                                                {" "}
                                                (HH:MM)
                                            </Text>

                                            <TextInput
                                                style={
                                                    styles.input
                                                }
                                                value={
                                                    editTime
                                                }
                                                onChangeText={
                                                    setEditTime
                                                }
                                                placeholder="16:30"
                                                keyboardType="numbers-and-punctuation"
                                                maxLength={
                                                    5
                                                }
                                            />

                                            <View
                                                style={
                                                    styles.editButtons
                                                }
                                            >
                                                <TouchableOpacity
                                                    style={
                                                        styles.cancelEditButton
                                                    }
                                                    onPress={
                                                        cancelEditing
                                                    }
                                                >
                                                    <Text
                                                        style={
                                                            styles.cancelEditText
                                                        }
                                                    >
                                                        Cancel
                                                    </Text>
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    style={
                                                        styles.saveButton
                                                    }
                                                    onPress={() =>
                                                        saveEditedDate(
                                                            payment
                                                        )
                                                    }
                                                >
                                                    <Text
                                                        style={
                                                            styles.saveButtonText
                                                        }
                                                    >
                                                        Save
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ) : (
                                        <TouchableOpacity
                                            style={
                                                styles.editButton
                                            }
                                            onPress={() =>
                                                startEditing(
                                                    payment
                                                )
                                            }
                                        >
                                            <Text
                                                style={
                                                    styles.editButtonText
                                                }
                                            >
                                                Edit Date &
                                                Time
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            );
                        }
                    )
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F7F8FA",
    },

    content: {
        padding: 16,
        paddingBottom: 40,
    },

    center: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },

    back: {
        fontSize: 16,
        marginBottom: 16,
    },

    title: {
        fontSize: 25,
        fontWeight: "700",
    },

    memberName: {
        marginTop: 6,
        fontSize: 18,
        fontWeight: "600",
    },

    subtitle: {
        marginTop: 4,
        color: "#666",
    },

    paymentCard: {
        marginTop: 16,
        padding: 16,
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
    },

    paymentNumber: {
        fontSize: 16,
        fontWeight: "700",
        marginBottom: 8,
    },

    amount: {
        fontSize: 17,
        fontWeight: "700",
    },

    info: {
        marginTop: 5,
        fontSize: 14,
        color: "#555",
    },

    overrideInfo: {
        marginTop: 8,
        fontSize: 13,
        color: "#9A6700",
        fontWeight: "600",
    },

    editButton: {
        marginTop: 14,
        alignSelf: "flex-start",
        backgroundColor: "#222",
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 8,
    },

    editButtonText: {
        color: "#FFFFFF",
        fontWeight: "600",
    },

    editBox: {
        marginTop: 16,
    },

    label: {
        marginTop: 10,
        marginBottom: 6,
        fontSize: 14,
        fontWeight: "600",
    },

    input: {
        borderWidth: 1,
        borderColor: "#D5D5D5",
        borderRadius: 9,
        paddingHorizontal: 12,
        paddingVertical: 11,
        fontSize: 16,
        backgroundColor: "#FAFAFA",
    },

    editButtons: {
        flexDirection: "row",
        gap: 10,
        marginTop: 16,
    },

    cancelEditButton: {
        flex: 1,
        borderWidth: 1,
        borderColor: "#CCC",
        paddingVertical: 12,
        borderRadius: 9,
        alignItems: "center",
    },

    cancelEditText: {
        fontSize: 15,
        fontWeight: "600",
    },

    saveButton: {
        flex: 1,
        backgroundColor: "#222",
        paddingVertical: 12,
        borderRadius: 9,
        alignItems: "center",
    },

    saveButtonText: {
        color: "#FFFFFF",
        fontWeight: "700",
    },

    emptyContainer: {
        marginTop: 40,
        alignItems: "center",
    },
});
