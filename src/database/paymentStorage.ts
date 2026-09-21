import AsyncStorage from "@react-native-async-storage/async-storage";

export type Payment = {
    id: string;
    obligationId: string;
    memberId: string;

    year: number;
    month: number;

    calculatedAmount: number;
    calculatedPenalty: number;

    actualCollectedAmount: number;

    isManualOverride: boolean;
    overrideReason?: string;

    paidAt: string;

    createdAt: string;
    updatedAt: string;
};

const PAYMENTS_KEY = "mandal_payments";

export const getPayments = async (): Promise<Payment[]> => {
    try {
        const data =
            await AsyncStorage.getItem(
                PAYMENTS_KEY
            );

        if (!data) {
            return [];
        }

        return JSON.parse(data);
    } catch (error) {
        console.error(
            "Get payments error:",
            error
        );

        return [];
    }
};

export const savePayments = async (
    payments: Payment[]
): Promise<void> => {
    try {
        await AsyncStorage.setItem(
            PAYMENTS_KEY,
            JSON.stringify(payments)
        );
    } catch (error) {
        console.error(
            "Save payments error:",
            error
        );

        throw error;
    }
};

export const addPayment = async (
    payment: Omit<
        Payment,
        "id" | "createdAt" | "updatedAt"
    >
): Promise<Payment> => {
    const payments =
        await getPayments();

    const now =
        new Date().toISOString();

    const newPayment: Payment = {
        ...payment,

        id: `${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 9)}`,

        createdAt: now,
        updatedAt: now,
    };

    await savePayments([
        ...payments,
        newPayment,
    ]);

    return newPayment;
};

export const getPaymentsForObligation =
    async (
        obligationId: string
    ): Promise<Payment[]> => {
        const payments =
            await getPayments();

        return payments.filter(
            (payment) =>
                payment.obligationId ===
                obligationId
        );
    };

export const getTotalPaidForObligation =
    async (
        obligationId: string
    ): Promise<number> => {
        const payments =
            await getPaymentsForObligation(
                obligationId
            );

        return payments.reduce(
            (total, payment) =>
                total +
                payment.actualCollectedAmount,
            0
        );
    };

export const updatePayment = async (
    paymentId: string,
    updates: Partial<
        Pick<
            Payment,
            | "calculatedAmount"
            | "calculatedPenalty"
            | "actualCollectedAmount"
            | "isManualOverride"
            | "overrideReason"
            | "paidAt"
        >
    >
): Promise<void> => {
    const payments =
        await getPayments();

    const updatedPayments =
        payments.map((payment) =>
            payment.id === paymentId
                ? {
                    ...payment,
                    ...updates,
                    updatedAt:
                        new Date().toISOString(),
                }
                : payment
        );

    await savePayments(
        updatedPayments
    );
};