import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface RecaptchaResponse {
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
}

@Injectable()
export class RecaptchaService {
  private readonly logger = new Logger(RecaptchaService.name);
  private readonly secretKey: string;
  private readonly minScore: number = 0.5;
  private readonly verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';

  constructor(private configService: ConfigService) {
    this.secretKey = this.configService.get<string>('RECAPTCHA_SECRET_KEY') || '';
  }

  async verifyToken(token: string, expectedAction?: string): Promise<void> {
    // Skip verification if no secret key is configured (development mode)
    if (!this.secretKey) {
      this.logger.warn('reCAPTCHA secret key not configured - skipping verification');
      return;
    }

    if (!token) {
      throw new BadRequestException('Token de reCAPTCHA faltante');
    }

    try {
      const response = await axios.post<RecaptchaResponse>(
        this.verifyUrl,
        null,
        {
          params: {
            secret: this.secretKey,
            response: token,
          },
        }
      );

      const data = response.data;

      if (!data.success) {
        this.logger.error('reCAPTCHA verification failed', data['error-codes']);
        throw new BadRequestException('Verificación de reCAPTCHA falló');
      }

      // Check score (v3 only)
      if (data.score !== undefined && data.score < this.minScore) {
        this.logger.warn(
          `reCAPTCHA score too low: ${data.score} (min: ${this.minScore})`
        );
        throw new BadRequestException(
          'Verificación de seguridad falló. Por favor, intente nuevamente.'
        );
      }

      // Verify action matches (optional)
      if (expectedAction && data.action !== expectedAction) {
        this.logger.warn(
          `reCAPTCHA action mismatch: expected ${expectedAction}, got ${data.action}`
        );
        throw new BadRequestException('Acción de reCAPTCHA inválida');
      }

      this.logger.log(
        `reCAPTCHA verification successful - score: ${data.score}, action: ${data.action}`
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error('Error verifying reCAPTCHA with Google', error.message);
        throw new BadRequestException('Error al verificar reCAPTCHA');
      }
      throw error;
    }
  }
}
