import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  effect,
  inject,
  signal,
} from "@angular/core";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { PumpTelemetry } from "../../../../core/models/pump.models";
import { LanguageService } from "../../../../core/i18n/language.service";
import { ThemeService } from "../../../../core/theme/theme.service";
import {
  detectPrimaryFile,
  downloadModelBlob,
  readSceneModel,
  releaseSceneObject,
  SceneFormat,
  writeSceneModel,
} from "./scene-model-io";

interface PartLabel {
  id: string;
  key: string;
  point: THREE.Vector3;
  customName?: string;
}
interface PartSettings {
  visible: boolean;
  opacity: number;
  color: string;
  roughness: number;
  colorChanged: boolean;
  roughnessChanged: boolean;
}
interface OriginalLook {
  material: THREE.Material;
  color?: THREE.Color;
  opacity: number;
  roughness?: number;
  transparent: boolean;
  depthWrite: boolean;
}

@Component({
  selector: "app-pump-scene3d",
  standalone: true,
  templateUrl: "./pump-scene3d.component.html",
  styleUrl: "./pump-scene3d.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PumpScene3dComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  @Input({ required: true }) telemetry!: PumpTelemetry;
  @ViewChild("host", { static: true })
  private hostRef!: ElementRef<HTMLDivElement>;

  readonly i18n = inject(LanguageService);
  private readonly theme = inject(ThemeService);

  readonly focusedInterior = signal(false);
  readonly interiorVisible = signal(false);
  readonly explodedView = signal(false);
  readonly showLabels = signal(false);
  readonly sceneLocked = signal(true);
  readonly selectedPart = signal<string | null>(null);
  readonly partEditor = signal<PartSettings | null>(null);
  readonly exportScope = signal<"all" | "part">("all");
  readonly exportMenuOpen = signal(false);
  readonly importBusy = signal(false);
  readonly exportBusy = signal(false);
  readonly fileNotice = signal("");
  readonly fileError = signal(false);
  readonly formats: SceneFormat[] = ["glb", "gltf", "obj", "stl"];

  readonly annotationLabels = signal<PartLabel[]>([
    {
      id: "pump",
      key: "dashboard.digitalTwin",
      point: new THREE.Vector3(0.82, 2.18, 0.18),
    },
    {
      id: "impeller",
      key: "scene.internal",
      point: new THREE.Vector3(1.77, 1.38, 0.72),
    },
    {
      id: "boiler",
      key: "scene.boiler",
      point: new THREE.Vector3(-7.2, 3.35, 0.55),
    },
    {
      id: "radiators",
      key: "scene.radiators",
      point: new THREE.Vector3(1.4, 4.55, 4.85),
    },
    {
      id: "tank",
      key: "dashboard.roofTank",
      point: new THREE.Vector3(6.4, 3.9, -3.4),
    },
  ]);

  private destroyed = false;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private renderer?: THREE.WebGLRenderer;
  private controls?: OrbitControls;
  private resize?: ResizeObserver;
  private frame = 0;
  private labelFrame = 0;
  private impeller?: THREE.Group;
  private shaftMarker?: THREE.Group;
  private statusLight?: THREE.Mesh<
    THREE.SphereGeometry,
    THREE.MeshStandardMaterial
  >;
  private pumpWater?: THREE.Mesh<
    THREE.CylinderGeometry,
    THREE.MeshPhysicalMaterial
  >;
  private pumpAssembly?: THREE.Group;
  private boilerAssembly?: THREE.Group;
  private radiatorAssembly?: THREE.Group;
  private tankAssembly?: THREE.Group;
  private importedModel?: THREE.Group;
  private readonly partSettings = new Map<string, PartSettings>();
  private readonly materialDefaults = new Map<string, OriginalLook[]>();
  private selectionOutline?: THREE.BoxHelper;
  private floor?: THREE.Mesh;
  private floorMaterial?: THREE.MeshStandardMaterial;
  private grid?: THREE.GridHelper;
  private casingMaterials: THREE.MeshPhysicalMaterial[] = [];
  private waterParticles: THREE.Mesh[] = [];
  private flowCurve?: THREE.CatmullRomCurve3;
  private lineParticles: Array<{
    mesh: THREE.Mesh;
    curve: THREE.CatmullRomCurve3;
    speed: number;
    runningOnly?: boolean;
    hot?: boolean;
    zoneIndex?: number;
  }> = [];
  private burnerLight?: THREE.Mesh<
    THREE.SphereGeometry,
    THREE.MeshStandardMaterial
  >;
  private burnerHalo?: THREE.Mesh<
    THREE.SphereGeometry,
    THREE.MeshBasicMaterial
  >;
  private exchangerCoil?: THREE.Mesh<
    THREE.TorusKnotGeometry,
    THREE.MeshStandardMaterial
  >;
  private exchangerGlass?: THREE.Mesh<
    THREE.BoxGeometry,
    THREE.MeshPhysicalMaterial
  >;
  private radiatorPanels: Array<
    THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>
  > = [];
  private radiatorHeatCores: Array<
    THREE.Mesh<THREE.BoxGeometry, THREE.MeshPhysicalMaterial>
  > = [];
  private radiatorValveMeshes: Array<THREE.Group> = [];
  private burnerFlames: THREE.Mesh[] = [];
  private boilerStatusDisplay?: THREE.Mesh<
    THREE.BoxGeometry,
    THREE.MeshStandardMaterial
  >;
  private cameraGoal?: THREE.Vector3;
  private targetGoal?: THREE.Vector3;
  private readonly pumpFocus = new THREE.Vector3(0.82, 1.63, 0);
  private readonly clock = new THREE.Clock();

  constructor() {
    effect(() => this.applyTheme(this.theme.theme()));
  }

  ngAfterViewInit(): void {
    this.initScene();
  }
  ngOnChanges(_changes: SimpleChanges): void {
    this.syncTelemetry();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.frame);
    this.resize?.disconnect();
    this.controls?.dispose();
    this.removeOutline();
    this.renderer?.dispose();
    this.scene?.traverse((obj: THREE.Object3D) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        const mats = Array.isArray(obj.material)
          ? obj.material
          : [obj.material];
        mats.forEach((material: THREE.Material) => material.dispose());
      }
    });
  }

  focusInterior(): void {
    if (this.sceneLocked()) return;
    this.focusedInterior.set(true);
    this.cameraGoal = new THREE.Vector3(4.25, 2.55, 3.45);
    this.targetGoal = this.pumpFocus.clone();
  }

  resetView(): void {
    if (this.sceneLocked()) return;
    this.focusedInterior.set(false);
    this.explodedView.set(false);
    this.cameraGoal = new THREE.Vector3(13.2, 7.4, 15.4);
    this.targetGoal = new THREE.Vector3(-0.8, 1.75, 0.45);
  }

  toggleExploded(): void {
    if (!this.sceneLocked()) this.explodedView.update((value) => !value);
  }

  toggleLabels(): void {
    this.showLabels.update((value) => !value);
  }

  toggleSceneLock(): void {
    this.sceneLocked.update((locked) => !locked);
    if (this.controls) this.controls.enabled = !this.sceneLocked();
    if (this.sceneLocked()) this.closePartEditor();
  }

  openPartEditor(id: string): void {
    if (this.sceneLocked()) return;
    const object = this.objectForPart(id);
    if (!object) return;
    const settings = this.getOrCreatePartSettings(id, object);
    this.selectedPart.set(id);
    this.partEditor.set({ ...settings });
    this.updateOutline();
  }

  closePartEditor(): void {
    this.selectedPart.set(null);
    this.partEditor.set(null);
    this.removeOutline();
  }

  getPartMeasurements(): Array<{ label: string; value: string }> {
    const part = this.selectedPart();
    const t = this.telemetry;
    if (!part || !t) return [];
    switch (part) {
      case "pump":
        return [
          {
            label: this.i18n.t("dashboard.motorSpeed"),
            value: `${Math.round(t.rpm)} RPM`,
          },
          {
            label: this.i18n.t("gauge.dischargePressure"),
            value: `${t.pressureBar.toFixed(2)} bar`,
          },
        ];
      case "impeller":
        return [
          {
            label: this.i18n.t("dashboard.motorSpeed"),
            value: `${Math.round(t.rpm)} RPM`,
          },
        ];
      case "boiler":
        return [
          {
            label: this.i18n.t("dashboard.boilerSupply"),
            value: `${t.boilerSupplyC.toFixed(1)} °C`,
          },
          {
            label: this.i18n.t("dashboard.burner"),
            value: t.burnerOn
              ? this.i18n.t("heating.on")
              : this.i18n.t("heating.off"),
          },
        ];
      case "radiators":
        return [
          {
            label: this.i18n.t("heating.avgTemp"),
            value: `${(t.radiatorTempsC.reduce((a, b) => a + b, 0) / Math.max(1, t.radiatorTempsC.length)).toFixed(1)} °C`,
          },
        ];
      case "tank":
        return [
          {
            label: this.i18n.t("dashboard.estVolume"),
            value: `${Math.round(t.tankLevelPct)}%`,
          },
        ];
      default:
        return [];
    }
  }

  partName(id: string | null): string {
    const item = this.annotationLabels().find((label) => label.id === id);
    return item ? item.customName || this.i18n.t(item.key) : "";
  }

  focusSelectedPart(): void {
    const object = this.objectForPart(this.selectedPart());
    if (!object) return;
    object.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(object);
    if (bounds.isEmpty()) return;
    const center = bounds.getCenter(new THREE.Vector3());
    const radius = Math.max(
      0.65,
      bounds.getBoundingSphere(new THREE.Sphere()).radius,
    );
    const distance = THREE.MathUtils.clamp(radius * 2.8, 3.5, 25);
    this.cameraGoal = center
      .clone()
      .add(new THREE.Vector3(distance * 0.65, distance * 0.48, distance));
    this.targetGoal = center;
  }

  setPartVisibility(visible: boolean): void {
    const id = this.selectedPart();
    const object = this.objectForPart(id);
    if (!id || !object) return;
    this.getOrCreatePartSettings(id, object).visible = visible;
    object.visible = visible;
    this.refreshPartEditor(id);
    this.updateOutline();
  }

  setPartOpacity(raw: string): void {
    const id = this.selectedPart();
    const obj = this.objectForPart(id);
    if (!id || !obj) return;
    this.getOrCreatePartSettings(id, obj).opacity = THREE.MathUtils.clamp(
      Number(raw),
      0,
      100,
    );
    this.applyPartVisuals(id);
    this.refreshPartEditor(id);
  }

  setPartColor(hex: string): void {
    const id = this.selectedPart();
    const obj = this.objectForPart(id);
    if (!id || !obj || !/^#[\da-f]{6}$/i.test(hex)) return;
    const settings = this.getOrCreatePartSettings(id, obj);
    settings.color = hex;
    settings.colorChanged = true;
    this.applyPartVisuals(id);
    this.refreshPartEditor(id);
  }

  setPartRoughness(raw: string): void {
    const id = this.selectedPart();
    const obj = this.objectForPart(id);
    if (!id || !obj) return;
    const settings = this.getOrCreatePartSettings(id, obj);
    settings.roughness = THREE.MathUtils.clamp(Number(raw), 0, 100);
    settings.roughnessChanged = true;
    this.applyPartVisuals(id);
    this.refreshPartEditor(id);
  }

  resetPartAppearance(): void {
    const id = this.selectedPart();
    const obj = this.objectForPart(id);
    if (!id || !obj) return;
    this.resetPartMaterials(id, obj);
    this.partSettings.delete(id);
    obj.visible = true;
    const next = this.getOrCreatePartSettings(id, obj);
    this.partEditor.set({ ...next });
    this.syncTelemetry();
    this.updateOutline();
  }

  async importModel(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = "";
    if (!files.length || this.importBusy()) return;
    this.importBusy.set(true);
    this.fileError.set(false);
    try {
      const main = detectPrimaryFile(files);
      const loaded = await readSceneModel(files);
      if (this.destroyed || !this.scene) {
        releaseSceneObject(loaded.object);
        return;
      }
      const wrapper = new THREE.Group();
      wrapper.name = `imported-${main.name}`;
      const geometryRoot = loaded.object;
      const bounds = new THREE.Box3().setFromObject(geometryRoot);
      if (bounds.isEmpty())
        throw new Error("The model contains no visible geometry.");
      const extent = bounds.getSize(new THREE.Vector3());
      const longest = Math.max(extent.x, extent.y, extent.z);
      if (!Number.isFinite(longest) || longest <= 0)
        throw new Error("Invalid geometry size.");
      geometryRoot.scale.setScalar(5.2 / longest);
      const center = bounds
        .getCenter(new THREE.Vector3())
        .multiplyScalar(5.2 / longest);
      geometryRoot.position.sub(center);
      wrapper.position.set(0, 2.4, -7);
      wrapper.add(geometryRoot);
      if (this.importedModel) {
        this.closePartEditor();
        this.scene.remove(this.importedModel);
        releaseSceneObject(this.importedModel);
        this.partSettings.delete("imported");
        this.materialDefaults.delete("imported");
      }
      this.importedModel = wrapper;
      this.scene.add(wrapper);
      this.annotationLabels.update((items) => [
        ...items.filter((item) => item.id !== "imported"),
        {
          id: "imported",
          key: "scene.importedModel",
          customName: loaded.name,
          point: new THREE.Vector3(),
        },
      ]);
      this.showLabels.set(true);
      // Import always frames the new model; manual camera interaction stays locked until unlocked.
      this.cameraGoal = wrapper.position
        .clone()
        .add(new THREE.Vector3(5, 3.5, 8));
      this.targetGoal = wrapper.position.clone();
      this.fileNotice.set(
        this.i18n.t("scene.importSuccess") + " · " + loaded.name,
      );
    } catch (error) {
      this.fileError.set(true);
      this.fileNotice.set(
        error instanceof Error
          ? error.message
          : this.i18n.t("scene.importFailed"),
      );
    } finally {
      this.importBusy.set(false);
    }
  }

  removeImportedModel(): void {
    if (!this.importedModel || !this.scene) return;
    this.closePartEditor();
    this.scene.remove(this.importedModel);
    releaseSceneObject(this.importedModel);
    this.importedModel = undefined;
    this.annotationLabels.update((labels) =>
      labels.filter((label) => label.id !== "imported"),
    );
    this.partSettings.delete("imported");
    this.materialDefaults.delete("imported");
    this.fileNotice.set(this.i18n.t("scene.importRemoved"));
  }

  async exportModel(format: SceneFormat): Promise<void> {
    if (this.exportBusy() || !this.scene) return;
    this.exportBusy.set(true);
    this.fileError.set(false);
    this.exportMenuOpen.set(false);
    try {
      const group = new THREE.Group();
      group.name = "Hydro-Control-3D";
      if (this.exportScope() === "part") {
        const object = this.objectForPart(this.selectedPart());
        if (!object) throw new Error(this.i18n.t("scene.selectFirst"));
        if (!object.visible)
          throw new Error(this.i18n.t("scene.showBeforeExport"));
        object.updateWorldMatrix(true, true);
        const copy = object.clone(true);
        copy.position.set(0, 0, 0);
        copy.rotation.set(0, 0, 0);
        copy.scale.set(1, 1, 1);
        copy.applyMatrix4(object.matrixWorld);
        group.add(copy);
      } else {
        const helpers = new Set<THREE.Object3D>([
          ...(this.floor ? [this.floor] : []),
          ...(this.grid ? [this.grid] : []),
          ...this.waterParticles,
          ...this.lineParticles.map((item) => item.mesh),
          ...(this.selectionOutline ? [this.selectionOutline] : []),
        ]);
        this.scene.children.forEach((object) => {
          if (
            helpers.has(object) ||
            object instanceof THREE.Light ||
            !(object instanceof THREE.Group || object instanceof THREE.Mesh)
          )
            return;
          if (!object.visible) return;
          group.add(object.clone(true));
        });
      }
      if (!group.children.length)
        throw new Error(this.i18n.t("scene.nothingToExport"));
      const data = await writeSceneModel(group, format);
      downloadModelBlob(
        data,
        `hydro-control-${this.exportScope() === "part" ? this.selectedPart() || "part" : "plant"}.${format}`,
      );
      this.fileNotice.set(
        this.i18n.t("scene.exportSuccess") + ` · ${format.toUpperCase()}`,
      );
    } catch (error) {
      this.fileError.set(true);
      this.fileNotice.set(
        error instanceof Error
          ? error.message
          : this.i18n.t("scene.exportFailed"),
      );
    } finally {
      this.exportBusy.set(false);
    }
  }

  private objectForPart(id: string | null): THREE.Object3D | undefined {
    if (!id) return;
    return (
      {
        pump: this.pumpAssembly,
        impeller: this.impeller,
        boiler: this.boilerAssembly,
        radiators: this.radiatorAssembly,
        tank: this.tankAssembly,
        imported: this.importedModel,
      } as Record<string, THREE.Object3D | undefined>
    )[id];
  }

  private refreshPartEditor(id: string): void {
    const settings = this.partSettings.get(id);
    if (settings) this.partEditor.set({ ...settings });
  }

  private getOrCreatePartSettings(
    id: string,
    object: THREE.Object3D,
  ): PartSettings {
    const stored = this.partSettings.get(id);
    if (stored) return stored;
    let color = "#50cadf",
      roughness = 50;
    object.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const mat = Array.isArray(node.material)
        ? node.material[0]
        : node.material;
      if (mat instanceof THREE.MeshStandardMaterial) {
        color = "#" + mat.color.getHexString();
        roughness = Math.round(mat.roughness * 100);
      }
    });
    const settings: PartSettings = {
      visible: object.visible,
      opacity: 100,
      color,
      roughness,
      colorChanged: false,
      roughnessChanged: false,
    };
    this.partSettings.set(id, settings);
    return settings;
  }

  private rememberMaterials(
    id: string,
    object: THREE.Object3D,
  ): OriginalLook[] {
    const saved = this.materialDefaults.get(id);
    if (saved) return saved;
    const looks: OriginalLook[] = [];
    object.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const incoming = Array.isArray(node.material)
        ? node.material
        : [node.material];
      const materials = incoming.map((material) => material.clone());
      node.material = Array.isArray(node.material) ? materials : materials[0];
      for (const material of materials) {
        const standard = material as THREE.MeshStandardMaterial;
        looks.push({
          material,
          color: standard.color?.clone(),
          opacity: material.opacity,
          roughness:
            typeof standard.roughness === "number"
              ? standard.roughness
              : undefined,
          transparent: material.transparent,
          depthWrite: material.depthWrite,
        });
      }
    });
    this.materialDefaults.set(id, looks);
    return looks;
  }

  private applyPartVisuals(id: string): void {
    const object = this.objectForPart(id);
    const settings = this.partSettings.get(id);
    if (!object || !settings) return;
    object.visible = settings.visible;
    this.rememberMaterials(id, object).forEach((look) => {
      const mat = look.material as THREE.MeshStandardMaterial;
      if (settings.colorChanged && mat.color) mat.color.set(settings.color);
      if (settings.roughnessChanged && typeof mat.roughness === "number")
        mat.roughness = settings.roughness / 100;
      mat.opacity = (look.opacity * settings.opacity) / 100;
      const wasTransparent = mat.transparent;
      const isTransparent = look.transparent || settings.opacity < 100;
      mat.transparent = isTransparent;
      mat.depthWrite = look.depthWrite && settings.opacity >= 99;
      if (wasTransparent !== isTransparent) mat.needsUpdate = true;
    });
  }

  private resetPartMaterials(id: string, object: THREE.Object3D): void {
    // Restore original visual properties while keeping cloned materials owned by their mesh.
    const saved = this.materialDefaults.get(id);
    if (!saved) return;
    saved.forEach((look) => {
      const mat = look.material as THREE.MeshStandardMaterial;
      if (look.color && mat.color) mat.color.copy(look.color);
      if (look.roughness !== undefined && typeof mat.roughness === "number")
        mat.roughness = look.roughness;
      mat.opacity = look.opacity;
      mat.transparent = look.transparent;
      mat.depthWrite = look.depthWrite;
      mat.needsUpdate = true;
    });
  }

  private updateOutline(): void {
    this.removeOutline();
    const obj = this.objectForPart(this.selectedPart());
    if (!this.scene || !obj || !obj.visible || this.sceneLocked()) return;
    this.selectionOutline = new THREE.BoxHelper(obj, 0x36dbec);
    this.scene.add(this.selectionOutline);
  }

  private removeOutline(): void {
    if (!this.selectionOutline) return;
    this.scene?.remove(this.selectionOutline);
    this.selectionOutline.geometry.dispose();
    const material = this.selectionOutline.material;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else material.dispose();
    this.selectionOutline = undefined;
  }

  private initScene(): void {
    const host = this.hostRef.nativeElement;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x050d13, 15, 42);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
    this.camera.position.set(13.2, 7.4, 15.4);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setSize(host.clientWidth, host.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    host.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.055;
    this.controls.enablePan = true;
    this.controls.enabled = !this.sceneLocked();
    this.controls.minDistance = 2.25;
    this.controls.maxDistance = 28;
    this.controls.maxPolarAngle = Math.PI * 0.5;
    this.controls.target.set(-0.8, 1.75, 0.45);
    this.controls.addEventListener("start", () => {
      this.cameraGoal = undefined;
      this.targetGoal = undefined;
      this.focusedInterior.set(false);
    });

    this.scene.add(new THREE.HemisphereLight(0x93e7f8, 0x071017, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 2.45);
    key.position.set(5, 9, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(512, 512);
    this.scene.add(key);
    const rim = new THREE.PointLight(0x20d4f3, 34, 18, 2);
    rim.position.set(2.5, 3.4, 4.8);
    this.scene.add(rim);
    const warm = new THREE.PointLight(0xffb86a, 20, 12, 2);
    warm.position.set(-7.0, 3.1, 2.0);
    this.scene.add(warm);

    this.floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x071119,
      roughness: 0.92,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(36, 24),
      this.floorMaterial,
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.floor = floor;
    this.grid = new THREE.GridHelper(30, 42, 0x173846, 0x0d222d);
    this.grid.position.y = 0.012;
    this.scene.add(this.grid);

    this.buildPump();
    this.buildHydraulicCircuit();
    this.buildBoilerLoop();
    this.buildTank();
    this.buildFlowParticles();
    this.applyTheme(this.theme.theme());
    this.syncTelemetry();

    this.resize = new ResizeObserver(() => this.onResize());
    this.resize.observe(host);
    this.onResize();
    this.animate();
  }

  private buildPump(): void {
    if (!this.scene) return;
    const group = new THREE.Group();
    group.position.set(-0.5, 0.34, 0);
    group.name = "pump-assembly";

    const darkMetal = new THREE.MeshStandardMaterial({
      color: 0x14252e,
      roughness: 0.34,
      metalness: 0.86,
    });
    const motorMetal = new THREE.MeshStandardMaterial({
      color: 0x155e6d,
      roughness: 0.34,
      metalness: 0.72,
    });
    const steel = new THREE.MeshStandardMaterial({
      color: 0x60717a,
      roughness: 0.22,
      metalness: 0.94,
    });
    const bronze = new THREE.MeshStandardMaterial({
      color: 0xc98b3b,
      roughness: 0.3,
      metalness: 0.84,
    });
    const rubber = new THREE.MeshStandardMaterial({
      color: 0x071015,
      roughness: 0.9,
      metalness: 0.03,
    });
    const boltMat = new THREE.MeshStandardMaterial({
      color: 0xa6b4ba,
      roughness: 0.18,
      metalness: 0.96,
    });
    const glassCasing = new THREE.MeshPhysicalMaterial({
      color: 0x3a899a,
      transparent: true,
      opacity: 0.21,
      roughness: 0.12,
      metalness: 0.24,
      transmission: 0.18,
      thickness: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const glassFront = new THREE.MeshPhysicalMaterial({
      color: 0x80d8e6,
      transparent: true,
      opacity: 0.1,
      roughness: 0.05,
      metalness: 0.05,
      transmission: 0.38,
      thickness: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.casingMaterials.push(glassCasing, glassFront);

    const skid = new THREE.Mesh(
      new THREE.BoxGeometry(5.4, 0.18, 2.15),
      darkMetal,
    );
    skid.position.set(-0.45, 0.12, 0);
    skid.castShadow = skid.receiveShadow = true;
    group.add(skid);

    const railGeo = new THREE.BoxGeometry(5.1, 0.12, 0.18);
    [-0.83, 0.83].forEach((z) => {
      const rail = new THREE.Mesh(railGeo, steel);
      rail.position.set(-0.45, 0.28, z);
      group.add(rail);
    });
    const footGeo = new THREE.BoxGeometry(0.52, 0.42, 0.44);
    [-1.9, -0.2, 1.45].forEach((x) =>
      [-0.66, 0.66].forEach((z) => {
        const foot = new THREE.Mesh(footGeo, rubber);
        foot.position.set(x, 0.43, z);
        foot.castShadow = true;
        group.add(foot);
      }),
    );

    /* TEFC motor */
    const motorBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.76, 0.76, 2.65, 48),
      motorMetal,
    );
    motorBody.rotation.z = Math.PI / 2;
    motorBody.position.set(-1.18, 1.28, 0);
    motorBody.castShadow = true;
    group.add(motorBody);
    for (let i = -5; i <= 5; i++) {
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(0.075, 1.54, 1.54),
        darkMetal,
      );
      fin.position.set(-1.18 + i * 0.215, 1.28, 0);
      fin.castShadow = true;
      group.add(fin);
    }
    const motorRear = new THREE.Mesh(
      new THREE.CylinderGeometry(0.82, 0.82, 0.17, 48),
      darkMetal,
    );
    motorRear.rotation.z = Math.PI / 2;
    motorRear.position.set(-2.54, 1.28, 0);
    group.add(motorRear);
    const motorFront = new THREE.Mesh(
      new THREE.CylinderGeometry(0.84, 0.84, 0.2, 48),
      steel,
    );
    motorFront.rotation.z = Math.PI / 2;
    motorFront.position.set(0.18, 1.28, 0);
    group.add(motorFront);
    const terminal = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.38, 0.62),
      darkMetal,
    );
    terminal.position.set(-1.2, 2.03, 0);
    terminal.castShadow = true;
    group.add(terminal);

    /* Shaft and coupling */
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.105, 0.105, 2.05, 24),
      steel,
    );
    shaft.rotation.z = Math.PI / 2;
    shaft.position.set(0.78, 1.28, 0);
    shaft.castShadow = true;
    group.add(shaft);
    const couplingGuard = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.36, 0.62, 30, 1, true),
      glassCasing.clone(),
    );
    (couplingGuard.material as THREE.MeshPhysicalMaterial).opacity = 0.16;
    couplingGuard.rotation.z = Math.PI / 2;
    couplingGuard.position.set(0.48, 1.28, 0);
    group.add(couplingGuard);
    const couplingA = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 0.22, 30),
      bronze,
    );
    couplingA.rotation.z = Math.PI / 2;
    couplingA.position.set(0.34, 1.28, 0);
    group.add(couplingA);
    const couplingB = couplingA.clone();
    couplingB.position.x = 0.62;
    group.add(couplingB);

    /* Pump body: semi-transparent volute around the real internal impeller. */
    const pumpCenter = new THREE.Vector3(1.38, 1.3, 0);
    const rearPlate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.92, 0.92, 0.26, 64),
      glassCasing,
    );
    rearPlate.rotation.z = Math.PI / 2;
    rearPlate.position.copy(pumpCenter);
    rearPlate.position.x -= 0.16;
    group.add(rearPlate);
    const volute = new THREE.Mesh(
      new THREE.TorusGeometry(0.67, 0.29, 28, 72, Math.PI * 1.72),
      glassCasing,
    );
    volute.rotation.y = Math.PI / 2;
    volute.rotation.z = 0.38;
    volute.position.copy(pumpCenter);
    volute.castShadow = true;
    group.add(volute);
    const frontCover = new THREE.Mesh(
      new THREE.CylinderGeometry(0.91, 0.91, 0.07, 64),
      glassFront,
    );
    frontCover.rotation.z = Math.PI / 2;
    frontCover.position.copy(pumpCenter);
    frontCover.position.x += 0.32;
    group.add(frontCover);

    /* Visible water chamber */
    this.pumpWater = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 0.75, 0.12, 56),
      new THREE.MeshPhysicalMaterial({
        color: 0x1cc8ed,
        transparent: true,
        opacity: 0.11,
        transmission: 0.45,
        roughness: 0.06,
        depthWrite: false,
      }),
    );
    this.pumpWater.rotation.z = Math.PI / 2;
    this.pumpWater.position.copy(pumpCenter);
    this.pumpWater.position.x += 0.08;
    group.add(this.pumpWater);

    /* Main centrifugal impeller */
    this.impeller = new THREE.Group();
    this.impeller.position.copy(pumpCenter);
    this.impeller.position.x += 0.2;
    const backPlate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.61, 0.61, 0.09, 48),
      bronze,
    );
    backPlate.rotation.z = Math.PI / 2;
    this.impeller.add(backPlate);
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.25, 0.24, 36),
      bronze,
    );
    hub.rotation.z = Math.PI / 2;
    hub.position.x = 0.055;
    this.impeller.add(hub);
    const eye = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.045, 14, 36),
      steel,
    );
    eye.rotation.y = Math.PI / 2;
    eye.position.x = 0.145;
    this.impeller.add(eye);
    for (let i = 0; i < 7; i++) {
      const angle = (i * Math.PI * 2) / 7;
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.105, 0.48, 0.095),
        bronze,
      );
      blade.position.set(0.09, Math.cos(angle) * 0.31, Math.sin(angle) * 0.31);
      blade.rotation.x = angle + 0.58;
      blade.rotation.z = -0.18;
      this.impeller.add(blade);
    }
    const shroud = new THREE.Mesh(
      new THREE.TorusGeometry(0.53, 0.035, 12, 48),
      bronze,
    );
    shroud.rotation.y = Math.PI / 2;
    shroud.position.x = 0.17;
    this.impeller.add(shroud);
    group.add(this.impeller);

    /* A striped shaft marker makes rotation visually readable without the old external fan. */
    this.shaftMarker = new THREE.Group();
    this.shaftMarker.position.set(0.83, 1.28, 0);
    for (let i = 0; i < 4; i++) {
      const marker = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.035, 0.09),
        i % 2 ? bronze : steel,
      );
      marker.rotation.x = (i * Math.PI) / 2;
      this.shaftMarker.add(marker);
    }
    group.add(this.shaftMarker);

    /* Suction eye and discharge nozzle */
    const suction = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 1.08, 36),
      steel,
    );
    suction.rotation.z = Math.PI / 2;
    suction.position.set(2.19, 1.3, 0);
    suction.castShadow = true;
    group.add(suction);
    const suctionFlange = new THREE.Mesh(
      new THREE.CylinderGeometry(0.51, 0.51, 0.12, 36),
      steel,
    );
    suctionFlange.rotation.z = Math.PI / 2;
    suctionFlange.position.set(2.72, 1.3, 0);
    group.add(suctionFlange);
    const discharge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 1.08, 36),
      steel,
    );
    discharge.position.set(1.2, 2.16, 0);
    discharge.castShadow = true;
    group.add(discharge);
    const dischargeFlange = new THREE.Mesh(
      new THREE.CylinderGeometry(0.49, 0.49, 0.12, 36),
      steel,
    );
    dischargeFlange.position.set(1.2, 2.7, 0);
    group.add(dischargeFlange);

    /* Casing bolts */
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const bolt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 0.11, 10),
        boltMat,
      );
      bolt.rotation.z = Math.PI / 2;
      bolt.position.set(1.74, 1.3 + Math.cos(a) * 0.76, Math.sin(a) * 0.76);
      group.add(bolt);
    }

    this.statusLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 20, 20),
      new THREE.MeshStandardMaterial({
        color: 0x31e49a,
        emissive: 0x31e49a,
        emissiveIntensity: 3,
      }),
    );
    this.statusLight.position.set(-1.2, 2.23, 0.35);
    group.add(this.statusLight);

    group.traverse((obj: THREE.Object3D) => {
      if (obj instanceof THREE.Mesh) {
        obj.receiveShadow = true;
        if (
          !(
            obj.material instanceof THREE.MeshPhysicalMaterial &&
            obj.material.transparent
          )
        )
          obj.castShadow = true;
      }
    });
    this.pumpAssembly = group;
    this.scene.add(group);
  }

  private buildHydraulicCircuit(): void {
    if (!this.scene) return;
    const pipeMat = new THREE.MeshStandardMaterial({
      color: 0x304b58,
      roughness: 0.26,
      metalness: 0.9,
    });
    const waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x26c9ef,
      transmission: 0.28,
      transparent: true,
      opacity: 0.34,
      roughness: 0.08,
      metalness: 0.03,
      depthWrite: false,
    });

    /* Roof tank -> pump suction. Keeping this line separate makes the water path readable. */
    this.flowCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(6.35, 0.72, -3.4),
      new THREE.Vector3(5.7, 0.86, -2.55),
      new THREE.Vector3(4.75, 1.18, -1.28),
      new THREE.Vector3(3.45, 1.56, -0.28),
      new THREE.Vector3(2.22, 1.64, 0),
    ]);
    const feedPipe = new THREE.Mesh(
      new THREE.TubeGeometry(this.flowCurve, 80, 0.24, 18, false),
      pipeMat,
    );
    const feedWater = new THREE.Mesh(
      new THREE.TubeGeometry(this.flowCurve, 80, 0.14, 14, false),
      waterMat,
    );
    feedPipe.castShadow = true;
    this.scene.add(feedPipe, feedWater);

    const tankFlange = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.14, 30),
      pipeMat,
    );
    tankFlange.position.set(6.35, 0.72, -3.4);
    tankFlange.rotation.z = Math.PI / 2;
    this.scene.add(tankFlange);
    const pumpFlange = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.14, 30),
      pipeMat,
    );
    pumpFlange.position.set(2.22, 1.64, 0);
    pumpFlange.rotation.z = Math.PI / 2;
    this.scene.add(pumpFlange);
  }

  private buildBoilerLoop(): void {
    if (!this.scene) return;
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0xd3dde2,
      roughness: 0.36,
      metalness: 0.24,
    });
    const shellSide = new THREE.MeshStandardMaterial({
      color: 0xa8bac4,
      roughness: 0.44,
      metalness: 0.18,
    });
    const standMat = new THREE.MeshStandardMaterial({
      color: 0x182d37,
      roughness: 0.52,
      metalness: 0.74,
    });
    const pipeMetal = new THREE.MeshStandardMaterial({
      color: 0x2e4a57,
      roughness: 0.28,
      metalness: 0.88,
    });
    const hotWater = new THREE.MeshPhysicalMaterial({
      color: 0xf1924d,
      transmission: 0.18,
      transparent: true,
      opacity: 0.3,
      roughness: 0.12,
      metalness: 0.05,
      depthWrite: false,
    });
    const coldWater = new THREE.MeshPhysicalMaterial({
      color: 0x38bfe7,
      transmission: 0.2,
      transparent: true,
      opacity: 0.24,
      roughness: 0.12,
      metalness: 0.05,
      depthWrite: false,
    });
    const hotPanel = new THREE.MeshStandardMaterial({
      color: 0x394750,
      roughness: 0.45,
      metalness: 0.25,
    });

    this.boilerAssembly = new THREE.Group();
    this.radiatorAssembly = new THREE.Group();

    const standTop = new THREE.Mesh(
      new THREE.BoxGeometry(2.35, 0.11, 1.08),
      standMat,
    );
    standTop.position.set(-7.2, 1.15, 0);
    standTop.castShadow = standTop.receiveShadow = true;
    this.boilerAssembly.add(standTop);
    for (const x of [-8.0, -6.4]) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 1.05, 0.14),
        standMat,
      );
      leg.position.set(x, 0.58, -0.34);
      leg.castShadow = true;
      this.boilerAssembly.add(leg);
      const leg2 = leg.clone();
      leg2.position.z = 0.34;
      this.boilerAssembly.add(leg2);
    }

    const boiler = new THREE.Group();
    boiler.position.set(-7.2, 2.22, 0);
    const frontShell = new THREE.MeshPhysicalMaterial({
      color: 0xd7e1e5,
      transparent: true,
      opacity: 0.3,
      transmission: 0.16,
      roughness: 0.22,
      metalness: 0.18,
      depthWrite: false,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.85, 2.05, 1.05), [
      shellSide,
      shellSide,
      shellMat,
      shellMat,
      frontShell,
      shellSide,
    ]);
    body.castShadow = body.receiveShadow = true;
    boiler.add(body);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x84949b,
      metalness: 0.78,
      roughness: 0.24,
    });
    for (const x of [-0.91, 0.91]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 1.96, 0.06),
        frameMat,
      );
      rail.position.set(x, 0, 0.56);
      boiler.add(rail);
    }
    for (const y of [-0.97, 0.97]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(1.82, 0.06, 0.06),
        frameMat,
      );
      rail.position.set(0, y, 0.56);
      boiler.add(rail);
    }
    this.boilerStatusDisplay = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.3, 0.055),
      new THREE.MeshStandardMaterial({
        color: 0x16333e,
        emissive: 0x0c2330,
        emissiveIntensity: 1.1,
        metalness: 0.25,
        roughness: 0.35,
      }),
    );
    this.boilerStatusDisplay.position.set(0, 0.68, 0.555);
    boiler.add(this.boilerStatusDisplay);
    const displayFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.82, 0.4, 0.035),
      new THREE.MeshStandardMaterial({
        color: 0x6c7d86,
        metalness: 0.72,
        roughness: 0.28,
      }),
    );
    displayFrame.position.set(0, 0.68, 0.535);
    boiler.add(displayFrame);
    boiler.remove(this.boilerStatusDisplay);
    boiler.add(displayFrame, this.boilerStatusDisplay);
    for (const x of [-0.27, 0, 0.27]) {
      const knob = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 0.025, 20),
        new THREE.MeshStandardMaterial({
          color: 0x314852,
          metalness: 0.55,
          roughness: 0.36,
        }),
      );
      knob.rotation.x = Math.PI / 2;
      knob.position.set(x, 0.42, 0.565);
      boiler.add(knob);
    }
    const topLid = new THREE.Mesh(
      new THREE.BoxGeometry(1.92, 0.12, 1.08),
      shellSide,
    );
    topLid.position.set(0, 1.08, 0);
    boiler.add(topLid);
    const flue = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.24, 0.72, 28),
      new THREE.MeshStandardMaterial({
        color: 0x8d9aa0,
        metalness: 0.88,
        roughness: 0.2,
      }),
    );
    flue.position.set(0.44, 1.46, -0.12);
    flue.castShadow = true;
    boiler.add(flue);
    const innerPanel = new THREE.Mesh(
      new THREE.BoxGeometry(1.36, 1.3, 0.08),
      new THREE.MeshStandardMaterial({
        color: 0x162830,
        metalness: 0.44,
        roughness: 0.48,
      }),
    );
    innerPanel.position.set(0, -0.12, 0.49);
    boiler.add(innerPanel);

    const frontWindowMat = new THREE.MeshPhysicalMaterial({
      color: 0x94dff0,
      transparent: true,
      opacity: 0.12,
      roughness: 0.08,
      transmission: 0.55,
      depthWrite: false,
    });
    this.exchangerGlass = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.95, 0.06),
      frontWindowMat,
    );
    this.exchangerGlass.position.set(0, -0.12, 0.56);
    boiler.add(this.exchangerGlass);
    this.casingMaterials.push(frontWindowMat);

    this.exchangerCoil = new THREE.Mesh(
      new THREE.TorusKnotGeometry(0.26, 0.08, 96, 14, 2, 3),
      new THREE.MeshStandardMaterial({
        color: 0x4bc6e6,
        emissive: 0x0e6f86,
        emissiveIntensity: 0.4,
        metalness: 0.55,
        roughness: 0.25,
      }),
    );
    this.exchangerCoil.position.set(0, -0.12, 0.33);
    this.exchangerCoil.rotation.y = 0.55;
    boiler.add(this.exchangerCoil);

    this.burnerLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 18, 18),
      new THREE.MeshStandardMaterial({
        color: 0xffc36b,
        emissive: 0xff9d31,
        emissiveIntensity: 2.3,
      }),
    );
    this.burnerLight.position.set(0, -0.73, 0.26);
    boiler.add(this.burnerLight);
    this.burnerHalo = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 18, 18),
      new THREE.MeshBasicMaterial({
        color: 0xffb667,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      }),
    );
    this.burnerHalo.position.copy(this.burnerLight.position);
    boiler.add(this.burnerHalo);
    const flameColors = [0xffd36b, 0xff9f43, 0x6ccdf5];
    flameColors.forEach((color, index) => {
      const material = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 2.4 - index * 0.35,
        transparent: true,
        opacity: 0.72 - index * 0.12,
        roughness: 0.22,
      });
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.1 - index * 0.018, 0.34 - index * 0.045, 18),
        material,
      );
      flame.position.set(
        (index - 1) * 0.075,
        -0.56 + index * 0.02,
        0.31 + index * 0.006,
      );
      flame.rotation.z = (index - 1) * 0.12;
      boiler.add(flame);
      this.burnerFlames.push(flame);
    });
    this.boilerAssembly.add(boiler);

    const coldInCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-7.9, 1.64, -0.5),
      new THREE.Vector3(-7.9, 1.25, -0.5),
      new THREE.Vector3(-8.9, 1.25, -0.5),
    ]);
    this.boilerAssembly.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(coldInCurve, 28, 0.09, 10, false),
        pipeMetal,
      ),
    );
    this.boilerAssembly.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(coldInCurve, 28, 0.05, 10, false),
        coldWater,
      ),
    );
    this.createLineParticles(coldInCurve, 8, 0x7fe9ff, 0.00017, true);

    const hotOutCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-6.3, 2.62, 0.5),
      new THREE.Vector3(-5.45, 2.62, 0.5),
      new THREE.Vector3(-5.0, 2.08, 0.3),
    ]);
    this.boilerAssembly.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(hotOutCurve, 28, 0.09, 10, false),
        pipeMetal,
      ),
    );
    this.boilerAssembly.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(hotOutCurve, 28, 0.05, 10, false),
        hotWater,
      ),
    );
    this.createLineParticles(hotOutCurve, 8, 0xffc17a, 0.00018, true, true);

    const boilerLinkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.7, 3.08, 0),
      new THREE.Vector3(-0.7, 3.38, 0),
      new THREE.Vector3(-2.65, 3.36, 0.18),
      new THREE.Vector3(-4.75, 3.04, 0.34),
      new THREE.Vector3(-6.3, 2.62, 0.48),
    ]);
    this.boilerAssembly.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(boilerLinkCurve, 72, 0.15, 14, false),
        pipeMetal,
      ),
    );
    this.boilerAssembly.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(boilerLinkCurve, 72, 0.082, 12, false),
        coldWater,
      ),
    );
    this.createLineParticles(boilerLinkCurve, 16, 0x8deeff, 0.0002, true);

    const headerSupplyCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-6.3, 2.92, 0.38),
      new THREE.Vector3(-5.15, 3.62, 1.45),
      new THREE.Vector3(-2.5, 4.12, 3.25),
      new THREE.Vector3(4.6, 4.42, 4.6),
    ]);
    const headerReturnCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(4.6, 1.52, 4.6),
      new THREE.Vector3(1.65, 1.48, 4.18),
      new THREE.Vector3(-2.65, 1.6, 2.55),
      new THREE.Vector3(-7.8, 1.72, -0.35),
    ]);
    this.radiatorAssembly.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(headerSupplyCurve, 84, 0.13, 14, false),
        pipeMetal,
      ),
    );
    this.radiatorAssembly.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(headerSupplyCurve, 84, 0.072, 12, false),
        hotWater,
      ),
    );
    this.radiatorAssembly.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(headerReturnCurve, 84, 0.13, 14, false),
        pipeMetal,
      ),
    );
    this.radiatorAssembly.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(headerReturnCurve, 84, 0.072, 12, false),
        coldWater,
      ),
    );
    this.createLineParticles(
      headerSupplyCurve,
      22,
      0xffbb73,
      0.00019,
      true,
      true,
    );
    this.createLineParticles(headerReturnCurve, 22, 0x88e7ff, 0.00016, true);

    const radPositions = [-1.8, -0.2, 1.4, 3.0, 4.6];
    radPositions.forEach((x, index) => {
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(0.88, 1.0, 0.22),
        hotPanel.clone(),
      );
      panel.position.set(x, 2.55, 4.8);
      panel.castShadow = panel.receiveShadow = true;
      this.radiatorAssembly!.add(panel);
      this.radiatorPanels.push(
        panel as THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>,
      );

      const core = new THREE.Mesh(
        new THREE.BoxGeometry(0.72, 0.76, 0.08),
        new THREE.MeshPhysicalMaterial({
          color: 0xf6a24e,
          transparent: true,
          opacity: 0.38,
          transmission: 0.18,
          emissive: 0xa45413,
          emissiveIntensity: 0.2,
          depthWrite: false,
        }),
      );
      core.position.set(x, 2.55, 4.92);
      this.radiatorAssembly!.add(core);
      this.radiatorHeatCores.push(
        core as THREE.Mesh<THREE.BoxGeometry, THREE.MeshPhysicalMaterial>,
      );

      for (let fin = 0; fin < 6; fin++) {
        const finMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, 0.86, 0.12),
          shellSide,
        );
        finMesh.position.set(x - 0.28 + fin * 0.11, 2.55, 5.01);
        finMesh.castShadow = true;
        this.radiatorAssembly!.add(finMesh);
      }

      const dropHot = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x, 4.38, 4.6),
        new THREE.Vector3(x, 3.28, 4.72),
        new THREE.Vector3(x - 0.28, 3.08, 4.76),
      ]);
      const dropCold = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x + 0.28, 2.03, 4.76),
        new THREE.Vector3(x, 1.76, 4.68),
        new THREE.Vector3(x, 1.52, 4.6),
      ]);
      this.radiatorAssembly!.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(dropHot, 24, 0.055, 10, false),
          pipeMetal,
        ),
      );
      this.radiatorAssembly!.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(dropHot, 24, 0.03, 10, false),
          hotWater,
        ),
      );
      this.radiatorAssembly!.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(dropCold, 24, 0.055, 10, false),
          pipeMetal,
        ),
      );
      this.radiatorAssembly!.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(dropCold, 24, 0.03, 10, false),
          coldWater,
        ),
      );
      this.createLineParticles(
        dropHot,
        5,
        0xffbf77,
        0.00018,
        true,
        true,
        index,
      );
      this.createLineParticles(
        dropCold,
        5,
        0x8ce8ff,
        0.00014,
        true,
        false,
        index,
      );

      const valveGroup = new THREE.Group();
      valveGroup.position.set(x - 0.28, 3.13, 4.79);
      const valveBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.075, 0.18, 18),
        new THREE.MeshStandardMaterial({
          color: 0x4b6772,
          metalness: 0.76,
          roughness: 0.28,
        }),
      );
      valveBody.rotation.x = Math.PI / 2;
      valveGroup.add(valveBody);
      const valveHandle = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.045, 0.06),
        new THREE.MeshStandardMaterial({
          color: 0x42d8c5,
          emissive: 0x0a584f,
          emissiveIntensity: 0.35,
          metalness: 0.22,
          roughness: 0.4,
        }),
      );
      valveHandle.position.z = 0.1;
      valveGroup.add(valveHandle);
      this.radiatorAssembly!.add(valveGroup);
      this.radiatorValveMeshes.push(valveGroup);

      const badge = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.18, 0.02),
        new THREE.MeshBasicMaterial({
          color: 0x7fe9ff,
          transparent: true,
          opacity: 0.65,
        }),
      );
      badge.position.set(x, 3.2, 5.02 + index * 0.001);
      this.radiatorAssembly!.add(badge);
    });

    this.scene.add(this.boilerAssembly, this.radiatorAssembly);
  }

  private buildTank(): void {
    if (!this.scene) return;
    this.tankAssembly = new THREE.Group();
    this.tankAssembly.name = "roof-tank";
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(1.08, 1.08, 3.3, 46, 1, true),
      new THREE.MeshPhysicalMaterial({
        color: 0x244754,
        transparent: true,
        opacity: 0.3,
        roughness: 0.2,
        metalness: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    tank.position.set(6.4, 1.75, -3.4);
    tank.castShadow = true;
    this.tankAssembly.add(tank);
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(1.08, 1.08, 0.12, 46),
      new THREE.MeshStandardMaterial({
        color: 0x38545f,
        metalness: 0.8,
        roughness: 0.28,
      }),
    );
    top.position.set(6.4, 3.4, -3.4);
    this.tankAssembly.add(top);
    const bottom = top.clone();
    bottom.position.y = 0.1;
    this.tankAssembly.add(bottom);
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(0.98, 0.98, 2.1, 42),
      new THREE.MeshPhysicalMaterial({
        color: 0x13a5d4,
        transparent: true,
        opacity: 0.3,
        transmission: 0.3,
        roughness: 0.08,
        depthWrite: false,
      }),
    );
    water.name = "tank-water";
    water.position.set(6.4, 1.2, -3.4);
    this.tankAssembly.add(water);
    this.scene.add(this.tankAssembly);
  }

  private buildFlowParticles(): void {
    if (!this.scene || !this.flowCurve) return;
    const material = new THREE.MeshBasicMaterial({
      color: 0x8deeff,
      transparent: true,
      opacity: 0.92,
    });
    for (let i = 0; i < 24; i++) {
      const p = new THREE.Mesh(
        new THREE.SphereGeometry(0.033 + (i % 3) * 0.007, 10, 10),
        material.clone(),
      );
      p.userData["offset"] = i / 24;
      p.position.copy(this.flowCurve.getPoint(i / 24));
      this.scene.add(p);
      this.waterParticles.push(p);
    }
  }

  private createLineParticles(
    curve: THREE.CatmullRomCurve3,
    count: number,
    color: number,
    speed: number,
    runningOnly = true,
    hot = false,
    zoneIndex?: number,
  ): void {
    if (!this.scene) return;
    for (let i = 0; i < count; i++) {
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: hot ? 0.85 : 0.78,
      });
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(hot ? 0.025 : 0.022, 10, 10),
        material,
      );
      mesh.userData["offset"] = i / count;
      mesh.position.copy(curve.getPoint(i / count));
      this.scene.add(mesh);
      this.lineParticles.push({
        mesh,
        curve,
        speed,
        runningOnly,
        hot,
        zoneIndex,
      });
    }
  }

  private updateAnnotationLabels(): void {
    const host = this.hostRef.nativeElement;
    if (!this.camera || !this.showLabels()) return;
    const rect = host.getBoundingClientRect();
    this.annotationLabels().forEach((item) => {
      const el = host.querySelector(
        `[data-label="${item.id}"]`,
      ) as HTMLButtonElement | null;
      if (!el) return;
      let anchor = item.point.clone();
      if (item.id === "imported" && this.importedModel) {
        this.importedModel.updateWorldMatrix(true, true);
        const bounds = new THREE.Box3().setFromObject(this.importedModel);
        anchor = bounds.getCenter(new THREE.Vector3());
        anchor.y = bounds.max.y + 0.2;
      }
      if ((item.id === "pump" || item.id === "impeller") && this.pumpAssembly) {
        anchor.add(
          this.pumpAssembly.position
            .clone()
            .sub(new THREE.Vector3(-0.5, 0.34, 0)),
        );
      } else if (item.id === "boiler" && this.boilerAssembly)
        anchor.add(this.boilerAssembly.position);
      else if (item.id === "radiators" && this.radiatorAssembly)
        anchor.add(this.radiatorAssembly.position);
      const projected = anchor.project(this.camera!);
      const visible = projected.z < 1 && projected.z > -1;
      const x = (projected.x * 0.5 + 0.5) * rect.width;
      const y = (-projected.y * 0.5 + 0.5) * rect.height;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.display = visible ? "block" : "none";
    });
  }

  private applyExplodedLayout(dt: number): void {
    const factor = this.explodedView() ? 1 : 0;
    if (this.pumpAssembly) {
      this.pumpAssembly.position.lerp(
        new THREE.Vector3(-0.5 - factor * 0.8, 0.34, factor * -0.45),
        Math.min(0.12, dt * 4),
      );
      this.pumpAssembly.rotation.y = THREE.MathUtils.lerp(
        this.pumpAssembly.rotation.y,
        factor * 0.18,
        Math.min(0.12, dt * 4),
      );
    }
    if (this.boilerAssembly) {
      this.boilerAssembly.position.lerp(
        new THREE.Vector3(factor * -0.9, 0, factor * -0.2),
        Math.min(0.12, dt * 4),
      );
      this.boilerAssembly.rotation.y = THREE.MathUtils.lerp(
        this.boilerAssembly.rotation.y,
        factor * -0.12,
        Math.min(0.12, dt * 4),
      );
    }
    if (this.radiatorAssembly) {
      this.radiatorAssembly.position.lerp(
        new THREE.Vector3(factor * 0.7, factor * 0.18, factor * 0.52),
        Math.min(0.12, dt * 4),
      );
      this.radiatorAssembly.rotation.y = THREE.MathUtils.lerp(
        this.radiatorAssembly.rotation.y,
        factor * 0.08,
        Math.min(0.12, dt * 4),
      );
    }
  }

  private syncTelemetry(): void {
    if (!this.telemetry || !this.scene) return;
    const light = this.statusLight?.material;
    if (light) {
      const c = this.telemetry.pumpRunning ? 0x31e49a : 0xff5f68;
      light.color.setHex(c);
      light.emissive.setHex(c);
      light.emissiveIntensity = this.telemetry.pumpRunning ? 3 : 1.5;
    }
    if (this.pumpWater) {
      const pressure = Math.min(
        1,
        Math.max(0, this.telemetry.pressureBar / 5.5),
      );
      this.pumpWater.material.opacity = 0.07 + pressure * 0.12;
      this.pumpWater.material.emissive = new THREE.Color(0x087f9d);
      this.pumpWater.material.emissiveIntensity = 0.08 + pressure * 0.2;
    }
    if (this.burnerLight && this.burnerHalo) {
      const active = this.telemetry.burnerOn;
      const material = this.burnerLight.material;
      material.color.setHex(active ? 0xffc36b : 0x6c7680);
      material.emissive.setHex(active ? 0xff9230 : 0x202830);
      material.emissiveIntensity = active ? 3.2 : 0.25;
      this.burnerHalo.visible = active;
      this.burnerHalo.material.opacity = active ? 0.22 : 0;
    }
    this.burnerFlames.forEach((flame, index) => {
      const active =
        this.telemetry.burnerOn &&
        this.telemetry.heatingFaultMode !== "BOILER_FAILURE";
      flame.visible = active;
      const mat = flame.material as THREE.MeshStandardMaterial;
      mat.opacity = active ? 0.72 - index * 0.12 : 0;
    });
    if (this.boilerStatusDisplay) {
      const mat = this.boilerStatusDisplay.material;
      const fault = this.telemetry.heatingFaultMode !== "NONE";
      mat.color.setHex(
        fault ? 0x4a2327 : this.telemetry.boilerEnabled ? 0x16333e : 0x283036,
      );
      mat.emissive.setHex(
        fault ? 0x8c252d : this.telemetry.burnerOn ? 0x5a3410 : 0x0c2330,
      );
      mat.emissiveIntensity = fault
        ? 1.8
        : this.telemetry.burnerOn
          ? 1.45
          : 0.55;
    }
    this.radiatorValveMeshes.forEach((group, index) => {
      const value = THREE.MathUtils.clamp(
        (this.telemetry.radiatorValvePcts[index] ?? 0) / 100,
        0,
        1,
      );
      group.rotation.z = THREE.MathUtils.lerp(Math.PI / 2, 0, value);
      const handle = group.children[1] as
        | THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>
        | undefined;
      if (handle) {
        handle.material.color.setHex(value > 0.05 ? 0x42d8c5 : 0xd85c5c);
        handle.material.emissive.setHex(value > 0.05 ? 0x0a584f : 0x6e1717);
        handle.material.emissiveIntensity = value > 0.05 ? 0.35 : 0.75;
      }
    });
    if (this.exchangerCoil) {
      const coilMat = this.exchangerCoil.material;
      const exchangerLoad = Math.max(
        0,
        Math.min(1, (this.telemetry.heatExchangerC - 25) / 50),
      );
      coilMat.color.setHSL(0.12 - exchangerLoad * 0.07, 0.82, 0.62);
      coilMat.emissive.setHSL(
        0.08 - exchangerLoad * 0.05,
        0.72,
        0.28 + exchangerLoad * 0.18,
      );
      coilMat.emissiveIntensity = 0.35 + exchangerLoad * 1.15;
    }
    this.radiatorPanels.forEach((panel, index) => {
      const temp = this.telemetry.radiatorTempsC[index] ?? 25;
      const ratio = THREE.MathUtils.clamp((temp - 22) / 35, 0, 1);
      panel.material.color.setHSL(
        0.58 - ratio * 0.48,
        0.2 + ratio * 0.1,
        0.25 + ratio * 0.22,
      );
      panel.material.emissive.setHSL(0.07, 0.8, ratio * 0.18);
      panel.material.emissiveIntensity = ratio * 0.45;
    });
    this.radiatorHeatCores.forEach((core, index) => {
      const temp = this.telemetry.radiatorTempsC[index] ?? 25;
      const ratio = THREE.MathUtils.clamp((temp - 22) / 35, 0, 1);
      core.material.opacity = 0.12 + ratio * 0.38;
      core.material.color.setHSL(0.58 - ratio * 0.48, 0.88, 0.55);
      core.material.emissive.setHSL(
        0.09 - ratio * 0.03,
        0.85,
        0.28 + ratio * 0.18,
      );
      core.material.emissiveIntensity = 0.18 + ratio * 0.8;
    });
    const water = this.scene.getObjectByName("tank-water") as
      | THREE.Mesh
      | undefined;
    if (water) {
      const level = Math.max(0.08, this.telemetry.tankLevelPct / 100);
      water.scale.y = level;
      water.position.y = 0.18 + 1.02 * level;
    }
    this.partSettings.forEach((_settings, id) => {
      if (this.materialDefaults.has(id)) this.applyPartVisuals(id);
    });
  }

  private animate = (): void => {
    this.frame = requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const running = this.telemetry?.pumpRunning ?? false;
    const speed = running ? Math.max(0.5, (this.telemetry?.rpm ?? 0) / 950) : 0;
    if (this.impeller) this.impeller.rotation.x += dt * speed * 3.15;
    if (this.shaftMarker) this.shaftMarker.rotation.x += dt * speed * 3.15;
    if (this.burnerHalo) {
      const active = this.telemetry?.burnerOn ?? false;
      const pulse = 1 + Math.sin(performance.now() * 0.008) * 0.08;
      this.burnerHalo.scale.setScalar(active ? pulse : 0.001);
    }
    this.burnerFlames.forEach((flame, index) => {
      if (!flame.visible) return;
      const t = performance.now() * (0.007 + index * 0.0014);
      flame.scale.y = 0.82 + Math.sin(t + index * 1.8) * 0.18;
      flame.scale.x = 0.92 + Math.cos(t * 0.75 + index) * 0.08;
      flame.position.y =
        -0.56 + index * 0.02 + Math.sin(t * 1.25 + index) * 0.018;
    });

    const flowSpeed = running
      ? Math.max(0.12, (this.telemetry?.flowLpm ?? 0) / 42)
      : 0;
    this.waterParticles.forEach((p) => {
      const o = p.userData["offset"] as number;
      const progress = (o + performance.now() * 0.0002 * flowSpeed) % 1;
      if (this.flowCurve) p.position.copy(this.flowCurve.getPoint(progress));
      p.visible = running;
    });
    this.lineParticles.forEach((item) => {
      const o = item.mesh.userData["offset"] as number;
      const zoneValve =
        item.zoneIndex === undefined
          ? 1
          : (this.telemetry?.radiatorValvePcts[item.zoneIndex] ?? 0) / 100;
      const airlock =
        item.zoneIndex === 2 && this.telemetry?.heatingFaultMode === "AIRLOCK"
          ? 0.18
          : 1;
      const pressureFactor =
        this.telemetry?.heatingFaultMode === "LOW_PRESSURE" ? 0.42 : 1;
      const boilerFactor =
        this.telemetry?.boilerEnabled &&
        this.telemetry?.heatingFaultMode !== "BOILER_FAILURE"
          ? 1
          : 0;
      const circuitFactor = zoneValve * airlock * pressureFactor * boilerFactor;
      const speedFactor = item.runningOnly
        ? running
          ? Math.max(0.1, (this.telemetry?.flowLpm ?? 0) / 30) *
            Math.max(0.08, circuitFactor)
          : 0
        : 0.85;
      const progress =
        (o +
          performance.now() *
            item.speed *
            Math.max(speedFactor, item.runningOnly ? 0 : 1)) %
        1;
      item.mesh.position.copy(item.curve.getPoint(progress));
      item.mesh.visible =
        !this.explodedView() &&
        (item.runningOnly ? running && circuitFactor > 0.025 : true);
      const pulse = item.hot
        ? 0.72 + Math.sin(performance.now() * 0.006 + o * 8) * 0.16
        : 0.6 + Math.sin(performance.now() * 0.005 + o * 6) * 0.12;
      (item.mesh.material as THREE.MeshBasicMaterial).opacity =
        pulse *
        (item.zoneIndex === undefined ? 1 : Math.max(0.15, circuitFactor));
    });

    if (this.camera && this.controls && this.cameraGoal && this.targetGoal) {
      this.camera.position.lerp(this.cameraGoal, 0.075);
      this.controls.target.lerp(this.targetGoal, 0.075);
      if (this.camera.position.distanceTo(this.cameraGoal) < 0.04) {
        this.cameraGoal = undefined;
        this.targetGoal = undefined;
      }
    }

    this.applyExplodedLayout(dt);

    if (this.camera) {
      const distance = this.camera.position.distanceTo(this.pumpFocus);
      this.interiorVisible.set(distance < 5.8);
      const near = THREE.MathUtils.clamp((distance - 2.3) / 5.4, 0, 1);
      this.casingMaterials.forEach(
        (m, i) =>
          (m.opacity =
            i === 0
              ? THREE.MathUtils.lerp(0.055, 0.22, near)
              : THREE.MathUtils.lerp(0.035, 0.11, near)),
      );
    }

    this.controls?.update();
    this.selectionOutline?.update();
    this.labelFrame = (this.labelFrame + 1) % 3;
    if (this.labelFrame === 0) this.updateAnnotationLabels();
    if (this.scene && this.camera && this.renderer)
      this.renderer.render(this.scene, this.camera);
  };

  private applyTheme(theme: "dark" | "light"): void {
    if (!this.scene) return;
    const dark = theme === "dark";
    if (this.scene.fog instanceof THREE.Fog)
      this.scene.fog.color.setHex(dark ? 0x050d13 : 0xd6e5ea);
    if (this.floorMaterial)
      this.floorMaterial.color.setHex(dark ? 0x071119 : 0xcbdce2);
    if (this.grid) {
      const mats = Array.isArray(this.grid.material)
        ? this.grid.material
        : [this.grid.material];
      mats.forEach(
        (
          mat: THREE.Material & {
            color?: THREE.Color;
            opacity?: number;
            transparent?: boolean;
          },
          index,
        ) => {
          mat.color?.setHex(
            dark ? (index ? 0x0d222d : 0x173846) : index ? 0xa9c2cc : 0x8aadb9,
          );
          mat.transparent = true;
          mat.opacity = dark ? 0.55 : 0.4;
        },
      );
    }
    if (this.renderer) this.renderer.toneMappingExposure = dark ? 1.04 : 0.93;
  }

  private onResize(): void {
    const host = this.hostRef.nativeElement;
    if (
      !this.camera ||
      !this.renderer ||
      !host.clientWidth ||
      !host.clientHeight
    )
      return;
    this.camera.aspect = host.clientWidth / host.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(host.clientWidth, host.clientHeight, false);
  }
}
