import { IsEmail, Length } from "class-validator";
import {
  Arg,
  Field,
  InputType,
  Mutation,
  ObjectType,
  Resolver,
} from "type-graphql";
import { Admin } from "../entity/admin.entity";
import { getRepository, Repository } from "typeorm";
import { hash, compareSync } from "bcryptjs";
import { sign } from "jsonwebtoken";
import { environment } from "../config/environment";

@InputType()
class AdminInput {
  @Field()
  @Length(3, 64)
  fullName!: string;

  @Field()
  @IsEmail()
  email!: string;

  @Field()
  @Length(8, 254)
  password!: string;
}

@InputType()
class LoginAdminInput {
  @Field()
  @IsEmail()
  email!: string;

  @Field()
  password!: string;
}

@ObjectType()
class LoginAdminResponse {
  @Field()
  adminId!: number;

  @Field()
  jwt!: string;
}

@Resolver()
export class AdminAuthResolver {
  adminRepository: Repository<Admin>;

  constructor() {
    this.adminRepository = getRepository(Admin);
  }

  @Mutation(() => Admin)
  async registerAdmin(
    @Arg("input", () => AdminInput) input: AdminInput
  ): Promise<Admin | undefined> {
    try {
      const { fullName, email, password } = input;

      const adminExists = await this.adminRepository.findOne({
        where: { email },
      });

      if (adminExists) {
        const error = new Error();
        error.message = "Email is not avaiable";
        throw error;
      }

      const hashedAdminPassword = await hash(password, 10);

      const newAdmin = await this.adminRepository.insert({
        fullName,
        email,
        password: hashedAdminPassword,
      });

      return this.adminRepository.findOne(newAdmin.identifiers[0].id);
    } catch (error) {
      throw new Error(error.message);
    }
  }

  @Mutation(() => LoginAdminResponse)
  async loginAdmin(
    @Arg("input", () => LoginAdminInput) input: LoginAdminInput
  ) {
    try {
      const { email, password } = input;

      const adminFound = await this.adminRepository.findOne({
        where: { email },
      });

      if (!adminFound) {
        const error = new Error();
        error.message = "Invalid credentials";
        throw error;
      }

      const isValidPassword: boolean = compareSync(
        password,
        adminFound.password
      );

      if (!isValidPassword) {
        const error = new Error();
        error.message = "Invalid credentials";
        throw error;
      }

      const jwt: string = sign(
        { id: adminFound.id },
        environment.JWTADMIN_SECRET
      );

      return {
        adminId: adminFound.id,
        jwt: jwt,
      };
    } catch (error) {
      throw new Error(error.message);
    }
  }
}
