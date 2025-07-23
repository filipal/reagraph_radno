import type { ReactNode } from 'react';
import React, { useState, useMemo } from 'react';
import type { NodeType, DetailedData, Credential, DataItemType } from '../types';
import { useSession } from '../context/SessionContext';
import { useGraph } from '../hooks/useGraph';
import styles from './ComputerEditorPanel.module.scss';
import {
  propagateNetworkChangeLandscape,
  propagateNetworkChangeFirewalls,
  propagateNetworkChangeDataservices,
  propagateNetworkChangeCredentials
} from '../utils/graphHelpers';

// Define basic types for this component


type Props = {
    computers: NodeType[];
    selectedComputer: NodeType | null;
    outputJson: any;
    onSelectComputer: (node: NodeType) => void;
    onSave: (updated: NodeType) => void;
    onCancel: () => void;
    viewMode: string;
};

// ➡️ Helper funkcija unutar ovog filea jer je koristi samo ComputerDrawerPanel
function countValidSoftwareForComputer(comp: NodeType): number {
  const installedSoftware = comp.meta?.originalComputer?.installed_software || {};
  let count = 0;

  for (const [swId, sw] of Object.entries(installedSoftware)) {
    if (!sw || typeof sw !== 'object') continue;

    const isUserMachineSoftware = sw.person_index === 0;
    const isNetworkSoftware = sw.provides_network_services?.length > 0;

    if (isUserMachineSoftware) {
      if (sw.provides_user_services && sw.provides_user_services.length > 0) {
        count++;
        continue;
      }

      if (!sw.provides_network_services || sw.provides_network_services.length === 0) {
        continue;
      }

      if (sw.accepts_credentials && sw.accepts_credentials.length > 0) {
        count++;
        continue;
      }

      if (sw.installed_combination && sw.installed_combination.length > 0) {
        count++;
        continue;
      }
      continue;
    }

    if (isNetworkSoftware) {
      count++;
    }
  }
  return count;
}

const ComputerDrawerPanel: React.FC<Props> = ({
    computers,
    selectedComputer,
    outputJson,
    onSelectComputer,
    onSave,
    viewMode,
    onCancel
}) => {
    const [activeTab, setActiveTab] = useState('general');
    const [drawerWidth, setDrawerWidth] = useState(400);
    const [collapsed, setCollapsed] = useState(false);
    const { editableJson, updateComputer, setGraphData } = useSession();
    const { updateNode, graphData } = useGraph();

    // Dohvati trenutno dodijeljenu mrežu za selectedComputer
    const currentNetworkId = Array.isArray(selectedComputer?.meta?.network_ids)
        ? String(selectedComputer.meta.network_ids[0])
        : '';

    // State za label i network
    const [localLabel, setLocalLabel] = useState<string>(selectedComputer?.label || '');
    const [localNetwork, setLocalNetwork] = useState<string>(currentNetworkId || '');

    // FUNKCIJA ZA DATASERVICES
    function getDataForSelectedComputer(): DetailedData[] {
    if (!selectedComputer || !outputJson?.data) {
        return [];
    }

    const dataIds = selectedComputer.meta?.originalComputer?.data || [];
    const installedSoftware = selectedComputer.meta?.originalComputer?.installed_software || {};

    // 🔁 Mapiramo instalirani softver po cpe_idn
    const installedSoftwareByCpeIdn: Record<string, any> = {};
    for (const [id, sw] of Object.entries(installedSoftware)) {
        if (sw && sw.cpe_idn) {
        installedSoftwareByCpeIdn[sw.cpe_idn] = sw;
        }
    }

    const result: DetailedData[] = [];

    for (const dataId of dataIds) {
        const dataEntry = outputJson.data[dataId];
        if (!dataEntry) {
        continue;
        }

        // ⛔️ FILTAR: samo ako postoji person_indexes i sadrži 0
        if (!Array.isArray(dataEntry.person_indexes) || !dataEntry.person_indexes.includes(0)) {
            continue;
        }

        const linkedSW = (dataEntry.linked_software || []).map((lsId: string) => {
        const swEntry = Object.entries(installedSoftware).find(([key]) => key.endsWith(lsId));
        const sw = swEntry?.[1];
        if (!sw) {
            return null;
        }
        return {
            computerId: selectedComputer.id,
            softwareId: lsId,
            name: sw.name || lsId
        };
        }).filter(Boolean) as {
        computerId: string;
        softwareId: string;
        name: string;
        }[];

        result.push({
        idn: dataEntry.idn || dataId,
        data_type: dataEntry.data_type || '-',
        protection_level: dataEntry.protection_level || '-',
        person_groups: dataEntry.person_groups || [],
        linked_software: linkedSW,
        principal_software: dataEntry.principal_software || '-',
        network_idn: dataEntry.network_idn || [],
        computer_idn: dataEntry.computer_idn || selectedComputer.id
        });
    }
    return result;
    }

    // Dohvati sve network segmente
    const availableNetworks = useMemo(() => {
        if (!outputJson?.computers) return [];
        const allNetworkIds = new Set<number>();
        for (const comp of Object.values(outputJson.computers) as any[]) {
            if (comp.network_idn) {
                comp.network_idn.forEach((id: number) => allNetworkIds.add(id));
            }
        }
        return Array.from(allNetworkIds).map(id => ({
            id: String(id),
            label: `Network ${id}`
        }));
    }, [outputJson]);

    const toggleCollapse = () => {
        setCollapsed(!collapsed);
        setDrawerWidth(collapsed ? 400 : 20);
    };

    const startResizing = (e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = drawerWidth;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const newWidth = startWidth - (moveEvent.clientX - startX);
            setDrawerWidth(Math.max(250, Math.min(800, newWidth)));
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    if (!selectedComputer) return null;

    function getRelevantSoftwareForSelectedComputer(): any[] {
    if (!selectedComputer?.meta?.originalComputer?.installed_software) return [];

    const installed = selectedComputer.meta.originalComputer.installed_software;
    const result: any[] = [];

    for (const [swId, sw] of Object.entries(installed) as [string, any][]) {
        if (!sw || typeof sw !== 'object') continue;

        const isUserMachineSoftware = sw.person_index === 0;
        const isNetworkSoftware = sw.provides_network_services?.length > 0;

        // 🧠 Parsiraj ime, verziju, patch itd. UNAPRIJED
        const { version, patch } = extractVersionAndPatch(swId);
        const parsedSw = {
        id: swId,
        name: extractReadableName(swId),
        version,
        patch_level: patch,
        services: getServiceType(sw),
        network: getNetworkId(sw),
        user: getPersonGroup(sw),
        ...sw
        };

        if (isUserMachineSoftware) {
        // ✅ Provjera #1: provides_user_services
        if (sw.provides_user_services && sw.provides_user_services.length > 0) {
            result.push(parsedSw);
            continue;
        }

        // ❌ Ako nema provides_network_services ➔ preskoči
        if (!sw.provides_network_services || sw.provides_network_services.length === 0) {
            continue;
        }

        // ✅ Provjera #2: accepts_credentials
        if (sw.accepts_credentials && sw.accepts_credentials.length > 0) {
            result.push(parsedSw);
            continue;
        }

        // ✅ Provjera #3: installed_combination
        if (sw.installed_combination && sw.installed_combination.length > 0) {
            result.push(parsedSw);
            continue;
        }

        // ❌ Ako ništa od toga nije ➔ preskoči
        continue;
        }

        // ✅ Ako je server softver s provides_network_services
        if (isNetworkSoftware) {
        result.push(parsedSw);
        }
    }

    return result;
    }


    function extractReadableName(swId: string): string {
    const core = swId.split('>').pop()?.split('#')[0] || '';

    // 1. Zamijeni _broj s :broj
    const normalized = core.replace(/_([0-9]+)/g, ':$1');

    // 2. Ukloni sve ispred i uključivo `:/` do prve `:`
    const afterSlash = normalized.replace(/^[^:]+:\/[^:]+:/, '');

    // 3. Ukloni prvi segment ako sadrži točku (npr. .net)
    const parts = afterSlash.split(':');
    const cleanParts = parts[0].includes('.') ? parts.slice(1) : parts;

    // 4. Ako prva dva segmenta nisu brojevi, spoji ih _ i zamijeni _ sa space
    let name = '';
    if (cleanParts.length > 1 && isNaN(Number(cleanParts[1]))) {
        name = `${cleanParts[0]}_${cleanParts[1]}`;
    } else {
        name = cleanParts[0];
    }

    name = name.replace(/\(.*?\)/g, '');
    name = name.replace(/_/g, ' ').trim();

    return name.replace(/\b\w/g, l => l.toUpperCase());
    }


    function extractVersionAndPatch(swId: string): { version: string; patch: string } {
    const core = swId.split('>').pop()?.split('#')[0] || '';
    const normalized = core.replace(/_([0-9]+)/g, ':$1');
    const withoutParens = normalized.replace(/\(.*?\)/g, '');
    const afterSlash = withoutParens.replace(/^[^:]+:\/[^:]+:/, '');
    const parts = afterSlash.split(':');
    const cleanParts = parts[0].includes('.') ? parts.slice(1) : parts;

    let version = '';
    let patch = '';

    for (let i = 1; i < cleanParts.length; i++) {
        const part = cleanParts[i];

        if (!version && /^\d+(\.\d+)*$/.test(part)) {
        version = part;
        continue;
        }

        if (
            part.toLowerCase().includes('update') ||
            part.toLowerCase().includes('patch') ||
            part.toLowerCase().includes('sp')
            ) {
            patch = part.replace(/_/g, ' ');

            // 🧩 Provjeri postoji li sljedeći dio koji je broj ➔ pridruži
            const next = cleanParts[i + 1];
            if (next && /^\d+(\.\d+)?$/.test(next)) {
                patch += ' ' + next;
                i++; // ➕ preskoči taj dio
            }
            continue;
        }
    }

    return { version, patch };
    }


    function getCredentialsForComputer(): Credential[] {
    if (!selectedComputer || !outputJson) return [];

    const selectedCompId = selectedComputer.id;
    const allCredentials = outputJson.credentials || {};
    const allComputers = outputJson.computers || {};

    const matchedCredentials: Credential[] = [];

    for (const [credId, credential] of Object.entries(allCredentials) as [string, Credential][]) {
        const hasRoot = credential.has_root === true;
        const linkedEmployees = credential.linked_employees || [];
        const linkedSoftware = credential.linked_software || [];
        const storedAt = credential.stored_at || [];

        // ➤ Preskoči ako credential NIJE pohranjen na ovom računalu
        if (!storedAt.includes(selectedCompId)) continue;

        // ➤ Uvjet: prikazujemo SAMO one linked_software koji imaju person_index === 0
        const filteredSW = linkedSoftware.filter((swId) => {
        const compId = swId.split('>')[0];
        const sw = allComputers?.[compId]?.installed_software?.[swId];
        return sw && sw.person_index === 0;
        });

        // ➤ Preskoči credential ako NI JEDAN softver ne zadovoljava
        if (filteredSW.length === 0) continue;

        // ➤ PRAVILO 1: Ako ima root ➝ prikaži uvijek
        if (hasRoot) {
        matchedCredentials.push({
            ...credential,
            linked_software: filteredSW,
            linked_employees: linkedEmployees
        });
        continue;
        }

        // ➤ PRAVILO 2: Ako postoji zaposlenik "admin" ➝ ne prikazivati credential
        const hasAdmin = linkedEmployees.some(([role]) => role === 'admin');
        if (hasAdmin) continue;

        // ➤ PRAVILO 3: Inače ➝ prikazujemo, ali samo zaposlenike s indeksom 0
        matchedCredentials.push({
        ...credential,
        linked_software: filteredSW,
        linked_employees: linkedEmployees.filter(([, idx]) => idx === 0)
        });
    }

    return matchedCredentials;
    }





    function getFirewallRulesForComputer(outputJson: any, computerId: string) {
        if (!outputJson?.computers?.[computerId]) return [];

        const computer = outputJson.computers[computerId];
        const installedSoftware = computer.installed_software || {};
        const installedSoftwareIds = Object.keys(installedSoftware); // Ne treba person_index provjera ovdje!

        const rules: {
            id: string;
            from: string[];
            to: string[];
            direction: 'in' | 'out';
        }[] = [];

        const allComputers = outputJson.computers || {};

        function isSoftwareWithPI0Anywhere(softwareId: string): boolean {
            for (const comp of Object.values(allComputers)) {
                const sw = (comp as any).installed_software?.[softwareId];
                if (sw?.person_index === 0) return true;
            }
            return false;
        }

        for (const [ruleId, rule] of Object.entries(outputJson.firewall_rules || {}) as [string, any][]) {
            const fromObjects: string[] = rule.from_objects || [];
            const toObjects: string[] = rule.to_objects || [];

            const hasFromInternet = fromObjects.includes('INTERNET');
            const hasToInternet = toObjects.includes('INTERNET');

            // ✅ INTERNET ➝ COMPUTER
            if (hasFromInternet) {
                const matchesTo = toObjects.filter(id => installedSoftwareIds.includes(id));
                if (matchesTo.length > 0) {
                    rules.push({
                        id: ruleId,
                        from: ['INTERNET'],
                        to: matchesTo,
                        direction: 'in' // Plava strelica jer je IN ➝ COMPUTER
                    });
                }
                continue;
            }

            // ✅ COMPUTER ➝ INTERNET
            if (hasToInternet) {
                const matchesFrom = fromObjects.filter(id => installedSoftwareIds.includes(id));
                if (matchesFrom.length > 0) {
                    rules.push({
                        id: ruleId,
                        from: matchesFrom,
                        to: ['INTERNET'],
                        direction: 'out' // Crvena strelica jer je COMPUTER ➝ OUT
                    });
                }
                continue;
            }

            // ✅ FROM softver je na selektiranom računalu
            const fromOnSelected = fromObjects.filter(id => installedSoftwareIds.includes(id));
            if (fromOnSelected.length > 0) {
                rules.push({
                    id: ruleId,
                    from: fromOnSelected,
                    to: toObjects,
                    direction: 'out' // Crvena
                });
                continue;
            }

            // ✅ TO softver je na selektiranom računalu
            const toOnSelected = toObjects.filter(id => installedSoftwareIds.includes(id));
            if (toOnSelected.length > 0) {
                const fromWithPI0 = fromObjects.filter(isSoftwareWithPI0Anywhere);
                if (fromWithPI0.length > 0) {
                    rules.push({
                        id: ruleId,
                        from: fromWithPI0,
                        to: toOnSelected,
                        direction: 'in' // Plava
                    });
                }
            }

            // Sve ostalo se preskače
        }

        return rules;
    }


    function getGeneralRows(viewMode: string, selectedComputer: NodeType, outputJson?: any, allComputers?: NodeType[]): ReactNode[] {
        const rows = [
            <tr key="id"><td><strong>ID</strong></td><td>{selectedComputer.id}</td></tr>,
            <tr key="label">
                <td><strong>Label</strong></td>
                <td>
                    <input
                        type="text"
                        value={localLabel}
                        onChange={(e) => setLocalLabel(e.target.value)}
                    />
                </td>
            </tr>
        ];

        if (viewMode === 'landscape') {
            rows.push(
            <tr key="used-hw">
                <td><strong>Used HW</strong></td>
                <td>{selectedComputer.meta?.originalComputer?.used_hardware_quota || '-'}</td>
            </tr>,
            <tr key="sw-count">
                <td><strong>Software Count</strong></td>
                <td>{Object.keys(selectedComputer.meta?.originalComputer?.installed_software || {}).length}</td>
            </tr>,
            <tr key="data-count">
                <td><strong>Data Count</strong></td>
                <td>{(selectedComputer.meta?.originalComputer?.data || []).length}</td>
            </tr>
            );
        } else if (viewMode === 'credentials') {
            const credentials = getCredentialsForComputer();

            const keyCount = credentials.filter(cred => cred.has_root === true).length;
            const lockCount = credentials.filter(cred => cred.has_root === false).length;

            rows.push(
            <tr key="keys">
                <td><strong>Credential Keys</strong></td>
                <td>{keyCount}</td>
            </tr>,
            <tr key="locks">
                <td><strong>Credential Locks</strong></td>
                <td>{lockCount}</td>
            </tr>
            );
        } else if (viewMode === 'dataservices') {

            const dataMap = outputJson?.data || {};
            const computerId = selectedComputer.id;
            const computerSW = selectedComputer.meta?.originalComputer?.installed_software || {};

            const counts: Record<string, number> = {};

            for (const [id, rawItem] of Object.entries(dataMap)) {
            const item = rawItem as {
                data_definition_idn?: string;
                linked_software?: string[];
                principal_software?: string;
                person_indexes?: number[];
            };

            const defIdn = item?.data_definition_idn;
            const personIndexes = item?.person_indexes || [];

            // ⛔️ FILTAR: samo ako postoji person_indexes i sadrži 0
            if (!personIndexes.includes(0)) continue;

            const linkedSW = item?.linked_software || [];
            const principalSW = item?.principal_software;

            const allRelatedSW = [...linkedSW];
            if (principalSW) allRelatedSW.push(principalSW);

            const isStoredHere = allRelatedSW.some((swId) =>
                Object.keys(computerSW).some(installedId =>
                installedId.endsWith(swId) && computerSW[installedId].person_index === 0
                )
            );

            if (isStoredHere && defIdn) {
                counts[defIdn] = (counts[defIdn] || 0) + 1;
            }
            }

            for (const [category, count] of Object.entries(counts)) {
            rows.push(
                <tr key={category}>
                <td>{category}</td>
                <td>{count} item(s)</td>
                </tr>
            );
        } 
        } else if (viewMode === 'firewalls') {
            const computerId = selectedComputer.id;
            const firewallRules = outputJson?.firewall_rules || {};
            let inboundCount = 0;
            let outboundCount = 0;

            for (const rule of Object.values(firewallRules) as any[]) {
                const from: string[] = rule.from_objects || [];
                const to: string[] = rule.to_objects || [];

                // ➤ Outbound: svako pojavljivanje selektiranog računala u from_objects
                outboundCount += from.filter(id => id.startsWith(computerId + '>')).length;

                // ➤ Inbound: ako je selektirani computer u to_objects, brojimo koliko from objekata ima ":0:" (person_index 0)
                if (to.some(id => id.startsWith(computerId + '>'))) {
                    inboundCount += from.filter(id => {
                        const beforeArrow = id.split('>')[0];
                        return beforeArrow.includes(':0:') || beforeArrow.endsWith(':0');
                    }).length;
                }

                // ➤ Poseban slučaj: ako je 'INTERNET' u from_objects, a računalo u to_objects → inbound veza
                if (from.includes('INTERNET') && to.some(id => id.startsWith(computerId + '>'))) {
                    inboundCount++;
                }

                // ➤ Poseban slučaj: ako je 'INTERNET' u to_objects, a računalo u from_objects → outbound veza
                if (to.includes('INTERNET')) {
                    outboundCount += from.filter(id => id.startsWith(computerId + '>')).length;
                }
            }

            rows.push(
                <tr key="inbound-summary">
                    <td><strong>Inbound Rules</strong></td>
                    <td colSpan={4}>{inboundCount} software entries</td>
                </tr>,
                <tr key="outbound-summary">
                    <td><strong>Outbound Rules</strong></td>
                    <td colSpan={4}>{outboundCount} software entries</td>
                </tr>
            );
        }

    return rows;
    }




    function getServiceType(sw: any): string[] {
    if (sw.provides_user_services?.length) return sw.provides_user_services;
    if (sw.provides_network_services?.length) return sw.provides_network_services;
    return [];
    }

    function getNetworkId(sw: any): string {
    return Array.isArray(sw.network_idn) ? sw.network_idn.join(', ') : sw.network_idn || '-';
    }

    function getPersonGroup(sw: any): string {
    return sw.person_group_id || 'server';
    }



    return (
        <div
            className={`${styles.panel} ${collapsed ? styles.collapsed : ''}`}
            style={{ width: collapsed ? '20px' : `${drawerWidth}px` }}
        >
            {/* Resize handle for dragging */}
            {!collapsed && (
                <div 
                    className={styles.resizeHandle}
                    onMouseDown={startResizing}
                />
            )}
            
            <div
                className={`${styles.headerButtons} ${collapsed ? styles.collapsedButtons : ''}`}
            >
                <button onClick={toggleCollapse} className={styles.backButton}>
                    {collapsed ? '⬅️' : '➡️'}
                </button>

                <button onClick={onCancel} className={styles.closeButton}>
                    ❌
                </button>
            </div>

            {!collapsed && (
                <>
                    <h4 className={styles.sectionTitle}>COMPUTERS LIST</h4>
                    <div className={styles.computersListTableWrapper}>
                        <table className={styles.computersListTable}>
                            <thead>
                                <tr>
                                    <th>Label</th>
                                    <th>Network</th>
                                    <th>HW</th>
                                    <th>SW</th>
                                </tr>
                            </thead>
                            <tbody>
                                {computers.map(comp => (
                                    <tr
                                        key={comp.id}
                                        onClick={() => onSelectComputer(comp)}
                                        className={selectedComputer?.id === comp.id ? styles.selectedRow : ''}
                                    >
                                        <td>{comp.label}</td>
                                        <td>{comp.meta?.network_ids?.join(', ')}</td>
                                        <td>{comp.meta?.originalComputer?.used_hardware_quota || '-'}</td>
                                        <td>{countValidSoftwareForComputer(comp)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Tabs */}
                    <div className={styles.tabs}>
                        <button onClick={() => setActiveTab('general')}>General</button>
                        <button onClick={() => setActiveTab('data')}>Data</button>
                        <button onClick={() => setActiveTab('software')}>Software</button>
                        <button onClick={() => setActiveTab('credentials')}>Credentials</button>
                        <button onClick={() => setActiveTab('firewalls')}>Firewalls</button>
                    </div>

                    {/* Tab Content */}
                    <div className={styles.tabContentContainer}>
                        <div className={styles.tabContentScrollable}>
                            {activeTab === 'general' && (
                                <div>
                                    <h4 className={styles.sectionTitle}>General Info</h4>
                                    <div className={styles.generalInfoTableWrapper}>
                                        <table className={styles.generalInfoTable}>
                                            <thead>
                                                <tr>
                                                    <th>Property</th>
                                                    <th>Value</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {getGeneralRows(viewMode, selectedComputer, outputJson, computers)}
                                            </tbody>
                                        </table>
                                    </div>

                                    <h4 className={styles.sectionTitle}>Network</h4>
                                    <div className={styles.networkTableWrapper}>
                                        <table className={styles.networkTable}>
                                            <thead>
                                                <tr>
                                                    <th>Current Network</th>
                                                    <th>Available Networks</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td>{selectedComputer.meta?.network_ids?.join(', ') || 'None'}</td>
                                                    <td>
                                                        <select
                                                            value={localNetwork}
                                                            onChange={(e) => setLocalNetwork(e.target.value)}
                                                        >
                                                            <option value="">Select network</option>
                                                            {availableNetworks.map((net: { id: string; label: string }) => (
                                                                <option key={net.id} value={net.id}>{net.label}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    <h4 className={styles.sectionTitle}>Data Summary</h4>
                                    <div className={styles.dataSummaryTableWrapper}>
                                        <table className={styles.dataSummaryTable}>
                                            <thead>
                                                <tr>
                                                    <th>Data ID</th>
                                                    <th>Type</th>
                                                    <th>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(selectedComputer.meta?.originalComputer?.data || [])
                                                    .filter((dataItem: string) => {
                                                    const fullData = outputJson?.data?.[dataItem];
                                                    return Array.isArray(fullData?.person_indexes) && fullData.person_indexes.includes(0);
                                                    })
                                                    .map((dataItem: string, idx: number) => (
                                                    <tr key={idx}>
                                                        <td>{dataItem}</td>
                                                        <td>Data</td>
                                                        <td>Active</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'data' && (
                                <div>
                                    <h4 className={styles.sectionTitle}>Data</h4>
                                    <div className={styles.dataTableWrapper}>
                                        <table className={styles.dataTable}>
                                            <thead>
                                                <tr>
                                                    <th>IDN</th>
                                                    <th>Type</th>
                                                    <th>Protection</th>
                                                    <th>Person groups</th>
                                                    <th>Linked SW</th>
                                                    <th>Principal SW</th>
                                                    <th>Network IDs</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                    {getDataForSelectedComputer().map((dataItem, idx) => (
                                                    <tr key={idx}>
                                                        <td>{dataItem.idn}</td>
                                                        <td>{dataItem.data_type}</td>
                                                        <td>{dataItem.protection_level}</td>
                                                        <td>{dataItem.person_groups.join(', ') || '-'}</td>
                                                        <td>
                                                        {dataItem.linked_software.map((sw, i) => (
                                                            <div
                                                            key={i}
                                                            style={{
                                                                display: 'block',
                                                                minWidth: '250px',
                                                                maxWidth: '400px',
                                                                wordBreak: 'break-word',       // ➡️ razlomi riječi ako treba
                                                                overflowWrap: 'anywhere',      // ➡️ razlomi bilo gdje
                                                                whiteSpace: 'normal',          // ➡️ omogući višeredni prikaz
                                                                marginBottom: '4px'
                                                            }}
                                                            >
                                                            {sw.name}
                                                            </div>
                                                        ))}
                                                        </td>
                                                        <td>{dataItem.principal_software}</td>
                                                        <td>{Array.isArray(dataItem.network_idn) ? dataItem.network_idn.join(', ') : dataItem.network_idn}</td>
                                                        <td>
                                                            <button>Edit</button>
                                                            <button>Delete</button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'software' && (
                                <div>
                                    <h4 className={styles.sectionTitle}>Software</h4>
                                    <div className={styles.softwareTableWrapper}>
                                        <table className={styles.softwareTable}>
                                            <thead>
                                                <tr>
                                                    <th>ID</th>
                                                    <th>Name</th>
                                                    <th>Version/Patch</th>
                                                    <th>Provides services</th>
                                                    <th>Compatible data types</th>
                                                    <th>Network</th>
                                                    <th>User</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {getRelevantSoftwareForSelectedComputer().map((sw, idx) => (
                                                    <tr key={idx}>
                                                        <td>{sw.id}</td>
                                                        <td>{sw.name}</td>
                                                        <td>{sw.version} / {sw.patch_level}</td>
                                                        <td>
                                                            <select multiple>
                                                                {(sw.services || []).map((s: string) => (
                                                                    <option key={s} value={s}>{s}</option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td>{(sw.compatible_data_types || []).join(', ')}</td>
                                                        <td>{sw.network}</td>
                                                        <td>{sw.user}</td>
                                                        <td>
                                                            <button>Edit</button>
                                                            <button>Delete</button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'credentials' && (
                                <div>
                                    <h4 className={styles.sectionTitle}>Credentials</h4>
                                    <div className={styles.credentialsTableWrapper}>
                                        <table className={styles.credentialsTable}>
                                            <thead>
                                                <tr>
                                                    <th>ID</th>
                                                    <th>Access</th>
                                                    <th>Has root</th>
                                                    <th>Linked software</th>
                                                    <th>Linked employees</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {getCredentialsForComputer().map((cred: any, idx: number) => (
                                                    <tr key={idx}>
                                                        <td>{cred.idn}</td>
                                                        <td>
                                                        <img
                                                            src={
                                                            cred.idn.includes('admin')
                                                                ? '/icons/lock.png'
                                                                : '/icons/key.png'
                                                            }
                                                            alt={cred.idn.includes('admin') ? 'Lock' : 'Key'}
                                                            style={{ width: '16px', height: '16px' }}
                                                        />
                                                        </td>
                                                        <td>
                                                            <input type="checkbox" checked={cred.has_root} readOnly />
                                                        </td>
                                                        <td>
                                                            <select multiple>
                                                                {(cred.linked_software || []).map((sw: string) => (
                                                                    <option key={sw} value={sw}>{sw}</option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td>
                                                            {(cred.linked_employees || []).map(([role]: [string, number], idx: number) => (
                                                                <div key={idx}>{role}</div>
                                                            ))}
                                                        </td>
                                                        <td>
                                                            <button>Edit</button>
                                                            <button>Delete</button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'firewalls' && (
                            <div>
                                <h4 className={styles.sectionTitle}>Firewall Rules</h4>
                                <div className={styles.credentialsTableWrapper}>
                                <table className={styles.credentialsTable}>
                                    <thead>
                                    <tr>
                                        <th>Rule ID</th>
                                        <th style={{ textAlign: 'center' }}>↔</th>
                                        <th>From</th>
                                        <th>To</th>
                                        <th>Actions</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {getFirewallRulesForComputer(outputJson, selectedComputer.id).map((rule, idx) => (
                                        <tr key={idx}>
                                        <td>{rule.id}</td>
                                        <td style={{ textAlign: 'center' }}>
                                        <img
                                            src={
                                            rule.direction === 'in'
                                                ? '/icons/blue-arrow.png'
                                                : rule.direction === 'out'
                                                ? '/icons/red-arrow.png'
                                                : '/icons/gray-arrow.png'
                                            }
                                            alt="arrow"
                                            style={{ width: '20px', height: '20px', objectFit: 'contain' }}
                                        />
                                        </td>                      
                                        <td>
                                            {(rule.from || []).map((f: string, i: number) => (
                                            <div
                                                key={i}
                                                style={{
                                                display: 'block',
                                                minWidth: '150px',
                                                maxWidth: '300px',
                                                wordBreak: 'break-word',
                                                overflowWrap: 'anywhere',
                                                whiteSpace: 'normal',
                                                marginBottom: '4px'
                                                }}
                                            >
                                                {f}
                                            </div>
                                            ))}
                                        </td>
                                        <td>
                                            {(rule.to || []).map((t: string, i: number) => (
                                            <div
                                                key={i}
                                                style={{
                                                display: 'block',
                                                minWidth: '150px',
                                                maxWidth: '300px',
                                                wordBreak: 'break-word',
                                                overflowWrap: 'anywhere',
                                                whiteSpace: 'normal',
                                                marginBottom: '4px'
                                                }}
                                            >
                                                {t}
                                            </div>
                                            ))}
                                        </td>
                                        <td>
                                            <button>Edit</button>
                                            <button>Delete</button>
                                        </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                                </div>
                            </div>
                            )}


                        </div>
                    </div>
                    <div className={styles.actions}>
                        <button onClick={() => {
                            if (selectedComputer) {
                                const newNetworkId = localNetwork ? [parseInt(localNetwork, 10)] : [];
                                const newGroup = localNetwork ? `network.internal.${localNetwork}` : undefined;

                                // 1. Ažuriraj JSON stanje
                                updateComputer(selectedComputer.id, { label: localLabel, network_idn: newNetworkId });

                                // 2. Pripremi ažurani čvor
                                const updatedComputerNode = {
                                    ...selectedComputer,
                                    label: localLabel,
                                    group: newGroup,
                                    meta: {
                                    ...selectedComputer.meta,
                                    network_ids: newNetworkId
                                    }
                                };

                                // 3. Pozovi helper funkciju za propagaciju mreže
                                let updatedGraph = graphData;
                                updatedGraph = propagateNetworkChangeLandscape(
                                    updatedGraph,
                                    updatedComputerNode.id,
                                    newGroup ?? '',
                                    newNetworkId,
                                    localLabel
                                );
                                updatedGraph = propagateNetworkChangeFirewalls(
                                    updatedGraph,
                                    updatedComputerNode.id,
                                    newGroup ?? '',
                                    newNetworkId,
                                    localLabel
                                );
                                updatedGraph = propagateNetworkChangeDataservices(
                                    updatedGraph,
                                    updatedComputerNode.id,
                                    newGroup ?? '',
                                    newNetworkId,
                                    localLabel
                                );
                                updatedGraph = propagateNetworkChangeCredentials(
                                    updatedGraph,
                                    updatedComputerNode.id,
                                    newGroup ?? '',
                                    localLabel,
                                    newNetworkId
                                );

                                // 4. Ažuriraj stanje grafa
                                setGraphData(updatedGraph);

                                // 5. Zatvori panel
                                onSave(updatedComputerNode);
                            }
                        }}>SAVE</button>
                        <button onClick={onCancel}>CANCEL</button>
                    </div>
                </>
            )}
        </div>
    );
};


export default ComputerDrawerPanel;