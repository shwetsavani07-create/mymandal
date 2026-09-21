import React, {
    useCallback,
    useState,
} from "react";

import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
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
    getInstallmentForMonth,
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
    deletePayment,
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

    const [paymentDate, setPaymentDate] =
        useState("");

    const [paymentTime, setPaymentTime] =
        useState("");

    const [paymentModalVisible, setPaymentModalVisible] =
        useState(false);

    const [manualOverride, setManualOverride] =
        useState(false);

    const [overrideReason, setOverrideReason] =
        useState("");

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
     * Convert a Date into the app's editable
     * DD/MM/YYYY and HH:MM format.
     */
    const formatDateForInput = (
        date: Date
    ) => {
        const day =
            String(date.getDate())
                .padStart(2, "0");

        const month =
            String(date.getMonth() + 1)
                .padStart(2, "0");

        const year =
            date.getFullYear();

        return `${day}/${month}/${year}`;
    };

    const formatTimeForInput = (
        date: Date
    ) => {
        const hours =
            String(date.getHours())
                .padStart(2, "0");

        const minutes =
            String(date.getMinutes())
                .padStart(2, "0");

        return `${hours}:${minutes}`;
    };

    /*
     * Convert the selected DD/MM/YYYY + HH:MM
     * into a real Date object.
     */
    const parsePaymentDateTime = (): Date | null => {
        const dateParts =
            paymentDate
                .trim()
                .split("/");

        const timeParts =
            paymentTime
                .trim()
                .split(":");

        if (
            dateParts.length !== 3 ||
            timeParts.length !== 2
        ) {
            return null;
        }

        const day =
            Number(dateParts[0]);

        const selectedMonth =
            Number(dateParts[1]);

        const selectedYear =
            Number(dateParts[2]);

        const hours =
            Number(timeParts[0]);

        const minutes =
            Number(timeParts[1]);

        if (
            !Number.isInteger(day) ||
            !Number.isInteger(selectedMonth) ||
            !Number.isInteger(selectedYear) ||
            !Number.isInteger(hours) ||
            !Number.isInteger(minutes)
        ) {
            return null;
        }

        if (
            selectedYear < 2000 ||
            selectedYear > 2100 ||
            selectedMonth < 1 ||
            selectedMonth > 12 ||
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
                selectedYear,
                selectedMonth - 1,
                day,
                hours,
                minutes,
                0,
                0
            );

        /*
         * Prevent JavaScript from accepting invalid
         * dates such as 31/02/2026.
         */
        if (
            date.getFullYear() !==
            selectedYear ||
            date.getMonth() !==
            selectedMonth - 1 ||
            date.getDate() !== day ||
            date.getHours() !== hours ||
            date.getMinutes() !== minutes
        ) {
            return null;
        }

        return date;
    };

    /*
     * Rebuild the monthly obligation from actual
     * payment records.
     *
     * This also repairs older records that were
     * incorrectly calculated using today's date.
     *
     * For multiple payments, the latest actual
     * payment date controls the month's current
     * penalty. The penalty is calculated once on
     * the full installment.
     */
    const reconcileMonthlyObligation =
        async (
            obligation: MonthlyObligation
        ): Promise<MonthlyObligation> => {
            const payments =
                await getPaymentsForObligation(
                    obligation.id
                );

            if (payments.length === 0) {
                const needsReset =
                    Math.abs(
                        obligation.currentAmountDue -
                        obligation.originalInstallment
                    ) > 0.009 ||
                    Math.abs(obligation.penalty) > 0.009 ||
                    Math.abs(obligation.paidAmount) > 0.009 ||
                    Math.abs(obligation.remainingAmount - obligation.originalInstallment) > 0.009 ||
                    obligation.status !== "pending";

                if (!needsReset) {
                    return obligation;
                }

                await updateMonthlyObligation(
                    obligation.id,
                    {
                        currentAmountDue:
                        obligation.originalInstallment,
                        penalty: 0,
                        paidAmount: 0,
                        remainingAmount:
                        obligation.originalInstallment,
                        status: "pending",
                    }
                );

                return {
                    ...obligation,
                    currentAmountDue:
                    obligation.originalInstallment,
                    penalty: 0,
                    paidAmount: 0,
                    remainingAmount:
                    obligation.originalInstallment,
                    status: "pending",
                    updatedAt:
                        new Date().toISOString(),
                };
            }

            const sortedPayments =
                [...payments].sort(
                    (a, b) =>
                        new Date(
                            b.paidAt
                        ).getTime() -
                        new Date(
                            a.paidAt
                        ).getTime()
                );

            const latestPayment =
                sortedPayments[0];

            const latestPaymentDate =
                new Date(
                    latestPayment.paidAt
                );

            const calculation =
                calculatePaymentAmount(
                    obligation.originalInstallment,
                    latestPaymentDate
                );

            const totalPaid =
                payments.reduce(
                    (
                        total,
                        payment
                    ) =>
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
                obligation.status !==
                status;

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

                status:

                status,

                updatedAt:
                    new Date().toISOString(),
            };
        };

    const loadMonthlyPayments =
        useCallback(
            async () => {
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
                        const member of
                        activeMembers
                        ) {
                        /*
                         * Resolve the installment that applies
                         * to this specific calendar month.
                         *
                         * A changed installment is scheduled
                         * from the next month, while an already
                         * created historical/current obligation
                         * remains unchanged.
                         */
                        const installmentForMonth =
                            await getInstallmentForMonth(
                                member.id,
                                year,
                                month
                            );

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
                                    installmentForMonth
                                );
                        }

                        /*
                         * Repair/reconcile existing
                         * payment data before displaying it.
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

                    setRows(
                        paymentRows
                    );
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
            },
            [year, month]
        );

    useFocusEffect(
        useCallback(
            () => {
                loadMonthlyPayments();
            },
            [loadMonthlyPayments]
        )
    );

    /*
     * Open the payment form.
     *
     * IMPORTANT:
     * The payment date is editable BEFORE saving.
     * The default is today, but the admin can enter
     * the real date the member actually paid.
     */
    const openPaymentDialog = async (
        row: MemberPaymentRow
    ) => {
        try {
            if (
                row.obligation.status ===
                "paid"
            ) {
                Alert.alert(
                    "Already Paid",
                    "This month's payment is already fully paid."
                );

                return;
            }

            const totalDue =
                row.obligation.currentAmountDue;

            const paidAmount =
                await getTotalPaidForObligation(
                    row.obligation.id
                );

            const remainingAmount =
                Math.max(
                    totalDue -
                    paidAmount,
                    0
                );

            if (
                remainingAmount <= 0
            ) {
                await updateMonthlyObligation(
                    row.obligation.id,
                    {
                        currentAmountDue:
                        totalDue,

                        penalty:
                        row.obligation.penalty,

                        paidAmount:
                        totalDue,

                        remainingAmount:
                            0,

                        status:
                            "paid",
                    }
                );

                await loadMonthlyPayments();

                return;
            }

            const now =
                new Date();

            setSelectedRow(row);

            setPaymentAmount(
                remainingAmount.toFixed(
                    2
                )
            );

            setPaymentDate(
                formatDateForInput(
                    now
                )
            );

            setPaymentTime(
                formatTimeForInput(
                    now
                )
            );

            setManualOverride(false);
            setOverrideReason("");

            setPaymentModalVisible(
                true
            );
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
        setPaymentModalVisible(
            false
        );

        setSelectedRow(null);

        setPaymentAmount("");

        setPaymentDate("");

        setPaymentTime("");
    };

    /**
     * Reverse the latest payment when the admin
     * accidentally marked an obligation as fully paid.
     *
     * Only the latest payment is removed. If other
     * partial payments exist, they remain untouched and
     * the obligation becomes partially paid again.
     */
    const handlePaidPress = async (
        row: MemberPaymentRow
    ) => {
        try {
            const payments =
                await getPaymentsForObligation(
                    row.obligation.id
                );

            if (payments.length === 0) {
                await loadMonthlyPayments();
                return;
            }

            const sortedPayments =
                [...payments].sort(
                    (a, b) =>
                        new Date(b.paidAt).getTime() -
                        new Date(a.paidAt).getTime()
                );

            const latestPayment =
                sortedPayments[0];

            Alert.alert(
                "Move Payment Back to Pending?",
                `The latest payment of ₹${latestPayment.actualCollectedAmount.toFixed(2)} for ${row.member.name} will be reversed.

This will remove that payment record and recalculate the monthly status.`,
                [
                    {
                        text: "Cancel",
                        style: "cancel",
                    },
                    {
                        text: "Reverse Payment",
                        style: "destructive",
                        onPress: async () => {
                            try {
                                await deletePayment(
                                    latestPayment.id
                                );

                                const remainingPayments =
                                    await getPaymentsForObligation(
                                        row.obligation.id
                                    );

                                if (
                                    remainingPayments.length ===
                                    0
                                ) {
                                    await updateMonthlyObligation(
                                        row.obligation.id,
                                        {
                                            currentAmountDue:
                                            row.obligation.originalInstallment,
                                            penalty: 0,
                                            paidAmount: 0,
                                            remainingAmount:
                                            row.obligation.originalInstallment,
                                            status: "pending",
                                        }
                                    );
                                } else {
                                    await reconcileMonthlyObligation(
                                        row.obligation
                                    );
                                }

                                await loadMonthlyPayments();

                                Alert.alert(
                                    "Payment Reversed",
                                    `${row.member.name}'s latest payment has been moved back to Pending.`
                                );
                            } catch (error) {
                                console.error(
                                    "Reverse payment error:",
                                    error
                                );

                                Alert.alert(
                                    "Error",
                                    "Unable to reverse the payment."
                                );
                            }
                        },
                    },
                ]
            );
        } catch (error) {
            console.error(
                "Prepare payment reversal error:",
                error
            );

            Alert.alert(
                "Error",
                "Unable to prepare the payment reversal."
            );
        }
    };

    /*
     * Calculate what the selected payment date
     * means for the current monthly obligation.
     */
    const getSelectedPaymentCalculation =
        () => {
            if (!selectedRow) {
                return null;
            }

            const selectedDate =
                parsePaymentDateTime();

            if (!selectedDate) {
                return null;
            }

            return calculatePaymentAmount(
                selectedRow.obligation
                    .originalInstallment,
                selectedDate
            );
        };

    const confirmPayment =
        async () => {
            if (!selectedRow) {
                return;
            }

            const amount = Number(paymentAmount);

            if (!Number.isFinite(amount) || amount <= 0) {
                Alert.alert(
                    "Invalid Amount",
                    "Please enter a valid payment amount."
                );
                return;
            }

            const selectedDate = parsePaymentDateTime();

            if (!selectedDate) {
                Alert.alert(
                    "Invalid Payment Date",
                    "Please enter a valid date and time.\\n\\nDate: DD/MM/YYYY\\nTime: HH:MM"
                );
                return;
            }

            if (manualOverride && !overrideReason.trim()) {
                Alert.alert(
                    "Reason Required",
                    "Please enter a reason for the manual amount override."
                );
                return;
            }

            try {
                const { member, obligation } = selectedRow;

                const calculation = calculatePaymentAmount(
                    obligation.originalInstallment,
                    selectedDate
                );

                const alreadyPaid =
                    await getTotalPaidForObligation(obligation.id);

                const totalDue = calculation.totalDue;

                const remainingBeforePayment = Math.max(
                    totalDue - alreadyPaid,
                    0
                );

                if (amount > remainingBeforePayment) {
                    Alert.alert(
                        "Amount Too High",
                        `Maximum amount that can be collected now is ₹${remainingBeforePayment.toFixed(2)}.`
                    );
                    return;
                }

                const newPaidAmount = alreadyPaid + amount;
                const newRemainingAmount = Math.max(
                    totalDue - newPaidAmount,
                    0
                );

                const newStatus =
                    newRemainingAmount === 0
                        ? "paid"
                        : "partially_paid";

                const cleanedOverrideReason = overrideReason.trim();

                Alert.alert(
                    "Confirm Payment",
                    `Member: ${member.name}\\n\\n` +
                    `Payment date: ${selectedDate.toLocaleDateString()}\\n` +
                    `Payment time: ${selectedDate.toLocaleTimeString()}\\n\\n` +
                    `Original installment: ₹${obligation.originalInstallment.toFixed(2)}\\n` +
                    `Calculated penalty: ₹${calculation.penalty.toFixed(2)}\\n` +
                    `Calculated total due: ₹${totalDue.toFixed(2)}\\n` +
                    `Already paid: ₹${alreadyPaid.toFixed(2)}\\n` +
                    `Actual amount collected: ₹${amount.toFixed(2)}\\n` +
                    `Remaining: ₹${newRemainingAmount.toFixed(2)}\\n\\n` +
                    (manualOverride
                        ? `Manual override: YES\\nReason: ${cleanedOverrideReason}`
                        : "Manual override: NO"),
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
                                    selectedDate,
                                    newPaidAmount,
                                    newRemainingAmount,
                                    newStatus,
                                    calculation.totalDue,
                                    calculation.penalty,
                                    manualOverride,
                                    manualOverride
                                        ? cleanedOverrideReason
                                        : undefined
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

    const savePayment =
        async (
            row: MemberPaymentRow,
            amount: number,
            selectedDate: Date,
            newPaidAmount: number,
            newRemainingAmount: number,
            newStatus:
                | "paid"
                | "partially_paid",
            calculatedAmount: number,
            calculatedPenalty: number,
            isManualOverride: boolean,
            overrideReason?: string
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
                    calculatedAmount,

                    calculatedPenalty:
                    calculatedPenalty,

                    actualCollectedAmount:
                    amount,

                    isManualOverride:
                    isManualOverride,

                    overrideReason:
                    overrideReason,

                    /*
                     * IMPORTANT:
                     * Save the actual payment date
                     * selected by the admin.
                     *
                     * This is NOT necessarily today.
                     */
                    paidAt:
                        selectedDate.toISOString(),
                });

                /*
                 * Save the amount calculated from
                 * the selected payment date.
                 */
                await updateMonthlyObligation(
                    row.obligation.id,
                    {
                        currentAmountDue:
                        calculatedAmount,

                        penalty:
                        calculatedPenalty,

                        paidAmount:
                        newPaidAmount,

                        remainingAmount:
                        newRemainingAmount,

                        status:
                        newStatus,
                    }
                );

                /*
                 * Reconcile once more from the
                 * stored payment records so the
                 * monthly obligation always matches
                 * the real payment history.
                 */
                const refreshedPayments =
                    await getPaymentsForObligation(
                        row.obligation.id
                    );

                await reconcileMonthlyObligation(
                    {
                        ...row.obligation,

                        currentAmountDue:
                        calculatedAmount,

                        penalty:
                        calculatedPenalty,

                        paidAmount:
                        newPaidAmount,

                        remainingAmount:
                        newRemainingAmount,

                        status:
                        newStatus,
                    }
                );

                /*
                 * Keep the variable above intentionally
                 * read so the save sequence is explicit:
                 * payment -> obligation -> reconciliation.
                 */
                void refreshedPayments;

                closePaymentDialog();

                Alert.alert(
                    "Payment Recorded",
                    `₹${amount.toFixed(
                        2
                    )} collected from ${row.member.name}.\n\n` +
                    `Payment date: ${selectedDate.toLocaleDateString()}\n` +
                    `Penalty: ₹${calculatedPenalty.toFixed(
                        2
                    )}`,
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

    const selectedCalculation =
        getSelectedPaymentCalculation();

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
                        style={
                            styles.title
                        }
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
                    <View
                        style={styles.list}
                    >
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
                                        onPress={() =>
                                            obligation.status ===
                                            "paid"
                                                ? handlePaidPress({
                                                    member,
                                                    obligation,
                                                })
                                                : openPaymentDialog({
                                                    member,
                                                    obligation,
                                                })
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

                {selectedRow && (
                    <Modal
                        visible={paymentModalVisible}
                        transparent
                        animationType="fade"
                        onRequestClose={closePaymentDialog}
                    >
                        <View style={styles.modalOverlay}>
                            <KeyboardAvoidingView
                                style={styles.modalKeyboardContainer}
                                behavior={
                                    Platform.OS === "ios"
                                        ? "padding"
                                        : undefined
                                }
                            >
                                <View style={styles.paymentPanel}>
                                    <ScrollView
                                        style={styles.modalScroll}
                                        contentContainerStyle={
                                            styles.modalScrollContent
                                        }
                                        keyboardShouldPersistTaps="handled"
                                        showsVerticalScrollIndicator={false}
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
                                            Original installment:
                                            {" "}
                                            ₹
                                            {selectedRow.obligation.originalInstallment.toFixed(
                                                2
                                            )}
                                        </Text>

                                        <Text
                                            style={
                                                styles.inputLabel
                                            }
                                        >
                                            Payment Date
                                            {" "}
                                            (DD/MM/YYYY)
                                        </Text>

                                        <TextInput
                                            style={
                                                styles.amountInput
                                            }
                                            value={
                                                paymentDate
                                            }
                                            onChangeText={
                                                setPaymentDate
                                            }
                                            placeholder="14/09/2026"
                                            keyboardType="numbers-and-punctuation"
                                            maxLength={10}
                                        />

                                        <Text
                                            style={
                                                styles.inputLabel
                                            }
                                        >
                                            Payment Time
                                            {" "}
                                            (HH:MM)
                                        </Text>

                                        <TextInput
                                            style={
                                                styles.amountInput
                                            }
                                            value={
                                                paymentTime
                                            }
                                            onChangeText={
                                                setPaymentTime
                                            }
                                            placeholder="19:30"
                                            keyboardType="numbers-and-punctuation"
                                            maxLength={5}
                                        />

                                        {selectedCalculation ? (
                                            <View
                                                style={
                                                    styles.calculationBox
                                                }
                                            >
                                                <Text
                                                    style={
                                                        styles.calculationTitle
                                                    }
                                                >
                                                    Calculation
                                                </Text>

                                                <Text
                                                    style={
                                                        styles.panelInfo
                                                    }
                                                >
                                                    Penalty:
                                                    {" "}
                                                    ₹
                                                    {selectedCalculation.penalty.toFixed(
                                                        2
                                                    )}
                                                </Text>

                                                <Text
                                                    style={
                                                        styles.panelInfo
                                                    }
                                                >
                                                    Total due:
                                                    {" "}
                                                    ₹
                                                    {selectedCalculation.totalDue.toFixed(
                                                        2
                                                    )}
                                                </Text>
                                            </View>
                                        ) : (
                                            <Text
                                                style={
                                                    styles.invalidDateText
                                                }
                                            >
                                                Enter a valid payment
                                                date and time to see
                                                the calculation.
                                            </Text>
                                        )}

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
                                                styles.overrideRow
                                            }
                                        >
                                            <View
                                                style={
                                                    styles.overrideTextContainer
                                                }
                                            >
                                                <Text
                                                    style={
                                                        styles.overrideTitle
                                                    }
                                                >
                                                    Manual amount override
                                                </Text>

                                                <Text
                                                    style={
                                                        styles.overrideDescription
                                                    }
                                                >
                                                    Turn this on only when the actual
                                                    collected amount intentionally differs
                                                    from the calculated amount.
                                                </Text>
                                            </View>

                                            <Switch
                                                value={manualOverride}
                                                onValueChange={(value) => {
                                                    setManualOverride(value);

                                                    if (!value) {
                                                        setOverrideReason("");
                                                    }
                                                }}
                                            />
                                        </View>

                                        {manualOverride && (
                                            <>
                                                <Text
                                                    style={
                                                        styles.inputLabel
                                                    }
                                                >
                                                    Override Reason *
                                                </Text>

                                                <TextInput
                                                    style={
                                                        styles.reasonInput
                                                    }
                                                    value={overrideReason}
                                                    onChangeText={
                                                        setOverrideReason
                                                    }
                                                    placeholder="Enter reason for changing the amount"
                                                    multiline
                                                    textAlignVertical="top"
                                                />
                                            </>
                                        )}

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

                                    </ScrollView>
                                </View>
                            </KeyboardAvoidingView>
                        </View>
                    </Modal>
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

    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.45)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },

    modalKeyboardContainer: {
        width: "100%",
        maxHeight: "90%",
    },

    paymentPanel: {
        width: "100%",
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 18,
        overflow: "hidden",
    },

    modalScroll: {
        width: "100%",
    },

    modalScrollContent: {
        paddingBottom: 4,
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

    calculationBox: {
        marginTop: 16,
        padding: 12,
        borderRadius: 10,
        backgroundColor: "#F2F2F2",
    },

    calculationTitle: {
        fontSize: 14,
        fontWeight: "700",
    },

    invalidDateText: {
        marginTop: 12,
        fontSize: 13,
        color: "#B00020",
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

    overrideRow: {
        marginTop: 16,
        padding: 12,
        borderRadius: 10,
        backgroundColor: "#F2F2F2",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
    },

    overrideTextContainer: {
        flex: 1,
    },

    overrideTitle: {
        fontSize: 14,
        fontWeight: "700",
    },

    overrideDescription: {
        marginTop: 4,
        fontSize: 12,
        lineHeight: 17,
        color: "#666",
    },

    reasonInput: {
        minHeight: 80,
        borderWidth: 1,
        borderColor: "#D5D5D5",
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
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
