import { calculatePenalty } from "./penalty";

export type PaymentCalculation = {
    originalInstallment: number;
    penalty: number;
    totalDue: number;
};

export const calculatePaymentAmount = (
    originalInstallment: number,
    paymentDate: Date
): PaymentCalculation => {
    const { penalty, totalDue } =
        calculatePenalty(
            originalInstallment,
            paymentDate
        );

    return {
        originalInstallment,
        penalty,
        totalDue,
    };
};
