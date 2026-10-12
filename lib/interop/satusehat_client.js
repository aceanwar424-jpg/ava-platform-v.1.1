/**
 * SATUSEHAT FHIR R4 REST API Client (Kemenkes RI)
 * Mendukung OAuth2 Client Credentials, Pengiriman Resource Laboratorium
 * (Patient, Observation, DiagnosticReport), dan Mode Simulasi/Sandbox.
 * Sesuai Permenkes No. 24 Tahun 2022 tentang Rekam Medis Elektronik.
 * 
 * OWNED_BY: generic
 */

const https = require('https');
const http = require('http');

class SatuSehatClient {
  /**
   * @param {Object} config
   * @param {string} [config.baseUrl] - Base URL FHIR API
   * @param {string} [config.authUrl] - Base URL OAuth2 Token
   * @param {string} [config.clientId] - Client ID Kemenkes
   * @param {string} [config.clientSecret] - Client Secret Kemenkes
   * @param {string} [config.organizationId] - ID Organisasi / Faskes
   * @param {boolean} [config.simulationMode=true] - Mode simulasi / unit test tanpa koneksi internet
   */
  constructor(config = {}) {
    this.simulationMode = config.simulationMode !== undefined ? config.simulationMode : true;
    this.baseUrl = config.baseUrl || 'https://api-satusehat-stg.kemkes.go.id/fhir-r4/v1';
    this.authUrl = config.authUrl || 'https://api-satusehat-stg.kemkes.go.id/oauth2/v1';
    this.clientId = config.clientId || '';
    this.clientSecret = config.clientSecret || '';
    this.organizationId = config.organizationId || '';
    
    this.accessToken = null;
    this.tokenExpiresAt = 0;
  }

  /**
   * Ambil Access Token OAuth2
   */
  async getAccessToken() {
    if (this.simulationMode) {
      this.accessToken = `mock_token_${Date.now()}`;
      this.tokenExpiresAt = Date.now() + 3600 * 1000;
      return this.accessToken;
    }

    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.accessToken;
    }

    if (!this.clientId || !this.clientSecret) {
      throw new Error('SATUSEHAT Client ID dan Client Secret wajib diisi untuk autentikasi');
    }

    const payload = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret
    }).toString();

    const response = await this._request('POST', `${this.authUrl}/accesstoken?grant_type=client_credentials`, {
      'Content-Type': 'application/x-www-form-urlencoded'
    }, payload);

    if (!response.access_token) {
      throw new Error(`Gagal memperoleh token SATUSEHAT: ${JSON.stringify(response)}`);
    }

    this.accessToken = response.access_token;
    this.tokenExpiresAt = Date.now() + (parseInt(response.expires_in, 10) || 3600) * 1000;
    return this.accessToken;
  }

  /**
   * Kirim Resource FHIR ke SATUSEHAT
   * @param {string} resourceType - 'Patient', 'Observation', 'DiagnosticReport', dsb.
   * @param {Object} resourceData - Payload FHIR JSON
   * @returns {Promise<Object>} Respons dari SATUSEHAT
   */
  async postResource(resourceType, resourceData) {
    if (!resourceType || !resourceData) {
      throw new Error('resourceType dan resourceData wajib diisi');
    }

    if (this.simulationMode) {
      return {
        status: 201,
        success: true,
        resourceType,
        id: resourceData.id || `ss-${resourceType.toLowerCase()}-${Date.now()}`,
        simulated: true,
        timestamp: new Date().toISOString()
      };
    }

    const token = await this.getAccessToken();
    const endpoint = `${this.baseUrl}/${resourceType}`;

    return this._request('POST', endpoint, {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }, JSON.stringify(resourceData));
  }

  /**
   * Bangun & Kirim Resource ServiceRequest (Order Permintaan Lab DPJP)
   * Sesuai standar HL7 FHIR R4 Kemenkes RI SATUSEHAT
   * @param {Object} params
   */
  async createServiceRequest(params = {}) {
    const {
      patientIhsId,
      encounterId,
      requesterIhsId,
      orderCode,
      orderName,
      priority = 'routine',
      authoredOn = new Date().toISOString()
    } = params;

    if (!patientIhsId || !orderCode) {
      throw new Error('patientIhsId dan orderCode wajib diisi untuk ServiceRequest');
    }

    const payload = {
      resourceType: 'ServiceRequest',
      status: 'active',
      intent: 'order',
      category: [
        {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: '108252007',
              display: 'Laboratory procedure'
            }
          ]
        }
      ],
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: orderCode,
            display: orderName || orderCode
          }
        ],
        text: orderName || orderCode
      },
      subject: {
        reference: `Patient/${patientIhsId}`
      },
      priority: priority,
      authoredOn: authoredOn
    };

    if (encounterId) {
      payload.encounter = { reference: `Encounter/${encounterId}` };
    }
    if (requesterIhsId) {
      payload.requester = { reference: `Practitioner/${requesterIhsId}` };
    }

    return this.postResource('ServiceRequest', payload);
  }

  /**
   * Bangun & Kirim Resource Specimen (Pengambilan Sampel Darah/Urin/dsb)
   * Menggunakan SNOMED CT specimen coding
   * @param {Object} params
   */
  async createSpecimen(params = {}) {
    const {
      patientIhsId,
      serviceRequestId,
      collectorIhsId,
      collectedDateTime = new Date().toISOString(),
      specimenTypeCode = '119297000', // Default blood specimen
      specimenTypeName = 'Blood specimen',
      receivedTime = new Date().toISOString()
    } = params;

    if (!patientIhsId) {
      throw new Error('patientIhsId wajib diisi untuk Specimen');
    }

    const payload = {
      resourceType: 'Specimen',
      status: 'available',
      type: {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: specimenTypeCode,
            display: specimenTypeName
          }
        ],
        text: specimenTypeName
      },
      subject: {
        reference: `Patient/${patientIhsId}`
      },
      collection: {
        collectedDateTime: collectedDateTime
      },
      receivedTime: receivedTime
    };

    if (collectorIhsId) {
      payload.collection.collector = { reference: `Practitioner/${collectorIhsId}` };
    }
    if (serviceRequestId) {
      payload.request = [{ reference: `ServiceRequest/${serviceRequestId}` }];
    }

    return this.postResource('Specimen', payload);
  }

  /**
   * Bangun & Kirim Resource Observation (Hasil Analit Berbasis LOINC & UCUM)
   * @param {Object} params
   */
  async createObservation(params = {}) {
    const {
      patientIhsId,
      encounterId,
      performerIhsId,
      specimenId,
      loincCode,
      analyteName,
      value,
      ucumUnit = '',
      refLow = null,
      refHigh = null,
      interpretationCode = 'N',
      effectiveDateTime = new Date().toISOString()
    } = params;

    if (!patientIhsId || !loincCode) {
      throw new Error('patientIhsId dan loincCode wajib diisi untuk Observation');
    }

    const payload = {
      resourceType: 'Observation',
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'laboratory',
              display: 'Laboratory'
            }
          ]
        }
      ],
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: loincCode,
            display: analyteName || loincCode
          }
        ],
        text: analyteName || loincCode
      },
      subject: {
        reference: `Patient/${patientIhsId}`
      },
      effectiveDateTime: effectiveDateTime,
      issued: new Date().toISOString()
    };

    if (typeof value === 'number') {
      payload.valueQuantity = {
        value: value,
        unit: ucumUnit,
        system: 'http://unitsofmeasure.org',
        code: ucumUnit
      };
    } else {
      payload.valueString = String(value);
    }

    if (refLow !== null || refHigh !== null) {
      payload.referenceRange = [
        {
          low: refLow !== null ? { value: refLow, unit: ucumUnit } : undefined,
          high: refHigh !== null ? { value: refHigh, unit: ucumUnit } : undefined
        }
      ];
    }

    if (interpretationCode) {
      payload.interpretation = [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
              code: interpretationCode,
              display: interpretationCode === 'N' ? 'Normal' : interpretationCode === 'H' ? 'High' : interpretationCode === 'L' ? 'Low' : interpretationCode
            }
          ]
        }
      ];
    }

    if (encounterId) {
      payload.encounter = { reference: `Encounter/${encounterId}` };
    }
    if (performerIhsId) {
      payload.performer = [{ reference: `Practitioner/${performerIhsId}` }];
    }
    if (specimenId) {
      payload.specimen = { reference: `Specimen/${specimenId}` };
    }

    return this.postResource('Observation', payload);
  }

  /**
   * Bangun & Kirim Resource DiagnosticReport (Laporan Diagnostik Kumulatif)
   * @param {Object} params
   */
  async createDiagnosticReport(params = {}) {
    const {
      patientIhsId,
      encounterId,
      performerIhsId,
      serviceRequestId,
      specimenId,
      observationIds = [],
      reportCode = '11502-2',
      reportTitle = 'Laboratory report',
      conclusion = 'Hasil pemeriksaan laboratorium lengkap',
      issuedDateTime = new Date().toISOString()
    } = params;

    if (!patientIhsId) {
      throw new Error('patientIhsId wajib diisi untuk DiagnosticReport');
    }

    const payload = {
      resourceType: 'DiagnosticReport',
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
              code: 'LAB',
              display: 'Laboratory'
            }
          ]
        }
      ],
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: reportCode,
            display: reportTitle
          }
        ],
        text: reportTitle
      },
      subject: {
        reference: `Patient/${patientIhsId}`
      },
      effectiveDateTime: issuedDateTime,
      issued: issuedDateTime,
      conclusion: conclusion,
      result: observationIds.map(id => ({ reference: `Observation/${id}` }))
    };

    if (encounterId) {
      payload.encounter = { reference: `Encounter/${encounterId}` };
    }
    if (performerIhsId) {
      payload.performer = [{ reference: `Practitioner/${performerIhsId}` }];
    }
    if (serviceRequestId) {
      payload.basedOn = [{ reference: `ServiceRequest/${serviceRequestId}` }];
    }
    if (specimenId) {
      payload.specimen = [{ reference: `Specimen/${specimenId}` }];
    }

    return this.postResource('DiagnosticReport', payload);
  }

  /**
   * Helper internal untuk HTTP/HTTPS Request
   */
  _request(method, fullUrl, headers, body = null) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(fullUrl);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const reqOptions = {
        method,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        headers: headers || {}
      };

      const req = client.request(reqOptions, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
            }
          } catch (e) {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ raw: data });
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          }
        });
      });

      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }
}

module.exports = { SatuSehatClient };
